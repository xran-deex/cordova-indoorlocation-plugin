var processor = require('./processor');
var DbModel = require('./DbModel');
var DEXIE = require('./Dexie');
var API_URL = 'http://valis.strangled.net/locationtracker';
var DATA_LENGTH = 41;

/**
 *  @function checkForCompleteDataSet
 *  Checks if the data set is complete. If so, write to the db.
 */
var checkForCompleteDataSet = function(model, vm){
    if(isDataComplete(model)){
        handleCompleteDataSet(model, vm);
    }
};

// various flags to track the current app state.
var _export = false,
_predict = false,
_collecting = false,
_display = true,
_sensor = false;
_train = false;
_collection_ctn = 0;
// the current training set to submit to the server
var training_data = [];
var preferedWifi = {
    data: null
};

/**
 *  @function handleCompleteDataSet - processes the complete data set. if predicting, sends it through the neural network,
 *                                     if exporting, adds the dataset to the training_data array for later submission.
 */
var handleCompleteDataSet = function(model, vm){
    // always attempt to save any newly discovered wifi hotspot ids.
    if(_predict){
        processor.constructInputData(vm.WIFI_ACCESS_POINTS, model, vm, function(data){
            //app.log(data);
            vm.dbModel.magnetic_field = null;
            indoor._train('default', {data: data, action: 'predict'}, vm.handlePredictionResponse);
            // create a new model if we are not exporting.
            //vm.dbModel = new app.DbModel();
        }, preferedWifi);
    }
    if(_export){
        processor.constructInputData(vm.WIFI_ACCESS_POINTS, model, vm, function(data){
            //app.log(data);
            if(data.length !== DATA_LENGTH) return;
            vm.collectCallback('Collected ' +(_collection_ctn++)+' values');
            training_data.push(data);
            vm.dbModel.magnetic_field = null;
        }, preferedWifi);
    }
    processor.save_ssid(model.wifi, vm.WIFI_ACCESS_POINTS, vm.APIKEY);
};

/**
 *  @function dataComplete - consider the data model complete if it has a lat, lng, wifi, and a non null mag array
 *
 */
var isDataComplete = function(dataModel){
    return dataModel.lat && dataModel.lng && dataModel.magnetic_field !== null && dataModel.wifi;
};

module.exports = function(){
    var self = this;
    this.dbModel = new DbModel();
    this.predicted_location = m.prop([]);
    this.predicted_name = m.prop();
    this.readMagnet = true;
    this.collectCallback = null;
    this.predictionCallback = null;
    this.APIKEY = null;
    this.WIFI_ACCESS_POINTS = new Map();

    this.stop = function(){
        if(_export){
            _export = !_export;
            var prefered = preferedWifi.data;
            self.start_sensor();
            // submit to the server
            submitToServer(_name, prefered);
        }
        sensorcollector.stop('geomagnet', 'magnetic_field', function(){});
        sensorcollector.stop('wifi', null, function(){});
        navigator.geolocation.clearWatch(self.locId);
        clearInterval(self.magTimeout);
        clearInterval(self.wifiscanId);
    };

    /**
     *  @function init - Initializes the helper class. Sets the apikey and downloads the wifi access point list
     *  @param {string} apikey - the application's api key
     */
    this.init = function(apikey) {
        this.APIKEY = apikey;
        cordova.plugins.backgroundMode.setDefaults({ text:'Training Network'});
        m.request({method:'get', url: API_URL + '/wifi?apikey=' + apikey}).then(function(res){
            // for each item in the result, if it is not already in the map, add it.
            res.forEach(function(item){
                if(!self.WIFI_ACCESS_POINTS.has(item.name)){
                    self.WIFI_ACCESS_POINTS.set(item.name, item);
                }
            });
        });
        // grab our database reference
        self.setupDB();
    };

    this.deleteDb = function(){
        self.db.delete();
    };

    this.deleteWifi = function(c){
        m.request({method:'delete', url: API_URL + '/wifi?apikey=' + self.APIKEY}).then(function(res){
            c(res);
        });
    };

    this.setupDB = function(){
        var db = new Dexie('SensorData');
    	db.version(1)
    		.stores({
                wifi_ssids: '++_id,&name',
                training_data: '++_id,training_id',
                trained_locations: '++_id,&name'
    		});
    	// Open the database
    	db.open()
    		.catch(function(error){
    			alert('Uh oh : ' + error);
    		});
        self.db = db;
    };

    /**
     *  Handles saving a trained network into localStorage
     */
    this.handleWorkerResponse = function(e){
        if(e.data.result){
            localStorage.setItem('network', JSON.stringify(e.data.network));
        }
    };

    var last_five = [];
    /**
     *  Finds the name of the trained location based on the predicted value
     *  @param val - the predicted value
     *  @param {function} callback - a callback that will be given the name
     */
    this.getPredictedName = function(val, callback){
        if(last_five.length < 5){
            last_five.unshift(val);
        } else {
            last_five.pop();
            last_five.unshift(val);
        }
        var map = {};
        val.forEach(function(item, index){
            map[index] = last_five.filter(function(v){
                return v[index] > 0.9;
            });
        });

        outer2: {
            for(var e in map){
                if(map[e].length >= 3){
                    callback(app.locations[e].name);
                    break outer2;
                } else {
                    callback(null);
                }
            }
        }
    };

    this.handlePredictionResponse = function(e){
        self.getPredictedName(e.data, function(name){
            if(name)
            self.predictionCallback({predictedName: name, predictionData: e.data});
        });
    };

    this.handleMagneticField = function(e){
        if(!self.readMagnet) return;
        if(typeof e === 'string') return;
        self.dbModel.magnetic_field = e;
        checkForCompleteDataSet(self.dbModel, self);
        self.readMagnet = false;
    };

    this.handleGeolocation = function(loc){
        self.dbModel.lat = loc.coords.latitude;
        self.dbModel.lng = loc.coords.longitude;
        checkForCompleteDataSet(self.dbModel, self);
    };

    this.handleWifi = function(wifi){
        if(!wifi) return;
        self.dbModel.wifi = wifi;
        checkForCompleteDataSet(self.dbModel, self);
    };

    /**
     *  Starts the sensors
     *  @param toggle - determines how often to collect data
     */
    this.collect = function(){
        clearInterval(self.magTimeout);
        clearInterval(self.wifiscanId);
        self.wifiscanId = setInterval(function(){
            sensorcollector.scan('wifi', null, self.handleWifi);
        }, 500);
        self.magTimeout = setInterval(function(){
            self.readMagnet = true;
        }, 100);

    };

    /**
     *  @function predict - Attempts to predict the current location based on the current environment
     *  @param {function} callback - a callback function that will be called with the name of the current location
     */
    this.predict = function(interval, callback){
        _predict = !_predict;
        if(_predict) {
            var network;
            m.request({method:'get', url: API_URL + '/default?apikey='+self.APIKEY}).then(function(res){
                var network_type = res.type;
                preferedWifi.data = res.preferedWifi;
                indoor._train(network_type, {local: app.local(), network: res.network, action: 'train'}, function(e){
                    console.log(e.data);
                    self.predictionCallback = callback;
                    self.start_sensor(interval);
                });
                app.locations = res.locations;
            });
        } else {
            self.start_sensor();
        }
    };

    /**
     *  @function start_sensor - starts recording data from the device sensors
     */
    this.start_sensor = function(interval){
        _sensor = !_sensor;
        if(_sensor){
            sensorcollector.start('geomagnet', 'magnetic_field', self.handleMagneticField);
            sensorcollector.start('wifi', null, function(e){});
            self.wifiscanId = setInterval(function(){
                sensorcollector.scan('wifi', null, self.handleWifi);
            }, interval);
            self.magTimeout = setInterval(function(){
                self.readMagnet = true;
            }, interval);
            self.locId = navigator.geolocation.watchPosition(self.handleGeolocation);
            cordova.plugins.backgroundMode.enable();
        } else {
            preferedWifi.data = null;
            cordova.plugins.backgroundMode.disable();
        }
    };

    /**
     *  @function submitToServer - submits the recently collected data to the api server
     */
    var submitToServer = function(name, prefered){
        var request = new Request(API_URL + '/data', {
            method: 'post',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({data:training_data, name: name, apikey: self.APIKEY, preferedWifi: prefered})
        });
        fetch(request).then(function(res){return res.json();}).then(function(e){
            training_data.length = 0;
            app.log(e);
        });
    };

    // the name of the location that we are currently collecting data for.
    var _name;
    /**
     *  @function export - starts the collection process. Starts the sensors, starts the collection.
     *  @param {string} name - the name of the location we are collecting data for
     *  @param {function} callback - a callback that fill get called with info about each data item collected
     */
    this.export = function(name, callback){
        this.collectCallback = callback;
        if(!name) return;
        _name = name;
        _export = true;
        // remove any existing trained network.
        localStorage.removeItem('network');
        self.start_sensor();
        _collection_ctn = 0;
        self.collect();
    };
};
