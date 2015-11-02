var lt = require('./processor');
    var DATA_LENGTH = 29;

    var writeToDbIfComplete = function(model, vm){
        if(dataComplete(model)){
            writeToDb(model, vm);
        }
    };
    var _export = false,
    _predict = false,
    _collecting = false,
    _display = true,
    _sensor = false;
    _train = false;
    _collection_ctn = 0;
    var writeToDb = function(model, vm){
        lt.WifiProcessor.insert_ssid(model.wifi, vm.db);
        if(_predict){
            lt.ML.constructInputData(model, vm.db, function(data){
                app.log(data);
                var id = data.shift();
                vm.dbModel.magnetic_field = null;
                machine._train('default', {data: data, action: 'predict'}, vm.handlePredictionResponse);
            });
        }
        if(_export){
            lt.ML.constructInputData(model, vm.db, function(data){
                app.log(data);
                var id = data.shift();
                if(data.length !== DATA_LENGTH) return;
                vm.collectCallback('Collected ' +(_collection_ctn++)+' values');
                vm.db.training_data.put({training_id: id, data: data});
                vm.dbModel.magnetic_field = null;
            });
        }
        if(!_export) {
            // create a new model if we are not exporting.
            vm.dbModel = new app.DbModel();
        }
    };

    /**
     *  @fn dataComplete - consider the data model complete if it has a lat, lng, wifi, and a non null mag array
     */
    var dataComplete = function(obj){
        return obj.lat && obj.lng && obj.magnetic_field !== null && obj.wifi;
    };

    module.exports = function(){
        var self = this;
        this.dbModel = new app.DbModel();
        this.predicted_location = m.prop([]);
        this.predicted_name = m.prop();
        this.readMagnet = true;
        this.collectCallback = null;
        this.predictionCallback = null;
        this.APIKEY = null;

        this.stop = function(){
            if(_export){
                _export = !_export;
                self.start_sensor();
                // submit to the server
                submitToServer(_name);
            }
            sensorcollector.stop('geomagnet', 'magnetic_field', function(){});
            sensorcollector.stop('wifi', null, function(){});
            navigator.geolocation.clearWatch(self.locId);
            clearInterval(self.magTimeout);
            clearInterval(self.wifiscanId);
        };

        this.init = function(apikey) {
            this.APIKEY = apikey;
            cordova.plugins.backgroundMode.setDefaults({ text:'Training Network'});

            // grab our database reference
            self.setupDB();
        };

        this.deleteDb = function(){
            self.db.delete();
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

        this.handleWorkerResponse = function(e){
            m.startComputation();
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

            if(app.loadedFromServer){
                outer2: {
                    for(var e in map){
                        if(map[e].length >= 3){
                            callback(app.locations[e].name);
                            break outer2;
                        } else {
                            callback('');
                        }
                    }
                }
            } else {
                self.db.trained_locations.toArray().then(function(locations){
                    var count = locations.length;
                    var diff = locations[0]._id;
                    outer: {
                        for(var e in map){
                            if(map[e].length >= 3){
                                callback(locations[e].name);
                                break outer;
                            } else {
                                callback('');
                            }
                        }
                    }
                });
            }
        };

        this.handlePredictionResponse = function(e){
            self.getPredictedName(e.data, function(name){
                self.predictionCallback({predictedName: name, predictionData: e.data});
            });
        };

        this.handleMagneticField = function(e){
            if(!self.readMagnet) return;
            if(typeof e === 'string') return;
            self.dbModel.magnetic_field = e;
            writeToDbIfComplete(self.dbModel, self);
            self.readMagnet = false;
        };

        this.handleGeolocation = function(loc){
            self.dbModel.lat = loc.coords.latitude;
            self.dbModel.lng = loc.coords.longitude;
            writeToDbIfComplete(self.dbModel, self);
        };

        this.handleWifi = function(wifi){
            if(!wifi) return;
            self.dbModel.wifi = wifi;
            writeToDbIfComplete(self.dbModel, self);
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

        this.train = function(){
            _train = !_train;
            if(!_train){
                machine._train('default', {local: app.local(), action: 'abort'});
                cordova.plugins.backgroundMode.disable();
            } else {
                cordova.plugins.backgroundMode.enable();
                var network = localStorage.getItem('network');
                app.loadedFromServer = false;
                if(network){
                    machine._train('default', {local: app.local(), network: network, action: 'train'}, a);
                } else
                self.db.training_data.toArray(function(data){
                    machine._train('default', {local: app.local(), data: data, action: 'train'}, self.handleWorkerResponse);
                });
            }
        };

        this.predict = function(callback){
            _predict = !_predict;
            if(_predict) {
                var network;
                if(!app.local()){
                    app.loadedFromServer = true;
                    m.request({method:'get', url:'http://valis.strangled.net/locationtracker/default?apikey='+self.APIKEY}).then(function(res){
                        machine._train('default', {local: app.local(), network: res.network, action: 'train'}, function(e){
                            console.log(e.data);
                            self.predictionCallback = callback;
                            self.start_sensor();
                        });
                        app.locations = res.locations;
                    });
                } else {
                    app.loadedFromServer = false;
                    // try to load a previously saved network...
                    network = localStorage.getItem('network');
                    if(network){
                        machine._train('default', {local: app.local(), network: network, action: 'train'}, function(e){
                            app.log(e.data);
                            self.predictionCallback = callback;
                            self.start_sensor();
                        });
                    }
                }
            } else {
                self.start_sensor();
            }
        };

        this.start_sensor = function(){
            _sensor = !_sensor;
            if(_sensor){
                sensorcollector.start('geomagnet', 'magnetic_field', self.handleMagneticField);
                sensorcollector.start('wifi', null, function(e){});
                self.wifiscanId = setInterval(function(){
                    sensorcollector.scan('wifi', null, self.handleWifi);
                }, app.freq());
                self.magTimeout = setInterval(function(){
                    self.readMagnet = true;
                }, 1000);
                self.locId = navigator.geolocation.watchPosition(self.handleGeolocation);
                cordova.plugins.backgroundMode.enable();
            } else {
                cordova.plugins.backgroundMode.disable();
            }
        };

        var submitToServer = function(name){
            self.db.trained_locations.where('name').equals(name).toArray(function(location){
                var id = location[0]._id;
                self.db.training_data.where('training_id').equals(id).toArray(function(data){
                    var request = new Request('http://valis.strangled.net/locationtracker/data', {
                        method: 'post',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({data:data, name: name, apikey: self.APIKEY})
                    });
                    fetch(request).then(function(res){return res.json();}).then(app.log);
                });
            });
        };

        var _name;
        this.export = function(name, callback){
            this.collectCallback = callback;
            if(!name) return;
            _name = name;
            _export = true;
            // remove any existing trained network.
            localStorage.removeItem('network');
            self.db.trained_locations.put({name: _name});
            self.start_sensor();
            _collection_ctn = 0;
            self.collect();
        };
    };
