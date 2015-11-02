module.exports = function(){
    /**
     *  @function decToBin - Converts a decimal to binary as an array of zeros and onDevicePaused
     *  @return {array} - an array of zeroes and ones
     */
    var decToBin = function(dec, maxNum){
        var result = [];
        decToBinHelper(result, dec);
        var numZerosToAdd = 5 - result.length;//Math.ceil(Math.sqrt(maxNum)) - result.length;
        while(numZerosToAdd > 0){
            numZerosToAdd--;
            result.unshift(0);
        }
        return result;
    };

    var decToBinHelper = function(arr, val){
        if(val <= 0) return;
        var rem = val % 2;
        val = Math.floor(val / 2);
        arr.unshift(rem);
        decToBinHelper(arr, val);
    };

    lt.WifiProcessor = {
        insert_ssid: function(list, db){
            if(!list) return;
            list.forEach(function(item){
                db.wifi_ssids.add({name: item.BSSID});//.catch(app.log);
            });
        },
        convert_to_binary: function(ssid, db, cb){
            db.wifi_ssids.where('name').equals(ssid).first().then(function(item){
                cb(decToBin(item._id), item.name);
            });
        },
        decToBin: decToBin
    };

    lt.ML = {
        constructInputData: function(model, db, cb){
            var result = [], maxItems = 48;
            //db.wifi_ssids.count(function(c){maxItems = c;});
            db.transaction('r', db.wifi_ssids, function(){
                model.wifi.forEach(function(item){
                    db.wifi_ssids.each(function(i){
                        if(i.name === item.BSSID){
                            result.push({bssid: i, signal: item});
                        }
                    });
                });
            }).then(function(){
                var newResult = [];
                // sort by level
                // result.sort(function(_this, _that){
                //     return _that.signal.Level - _this.signal.Level;
                // });

                result.forEach(function(item, idx){
                    if(idx < 4){ //originally 4, then 5, recently 7
                        var bin = lt.WifiProcessor.decToBin(item.bssid._id, maxItems);
                        bin.forEach(function(i){
                            newResult.push(i);
                        });
                        newResult.push((item.signal.Level + 100) / 100);
                    }
                });

                newResult.push((model.lat + 85) / 170);
                newResult.push((model.lng + 180) / 360);
                newResult.push((model.magnetic_field[0] + 180) / 360);
                newResult.push((model.magnetic_field[1] + 180) / 360);
                newResult.push((model.magnetic_field[2] + 180) / 360);
                db.trained_locations.count().then(function(i){
                    newResult.unshift(i);
                    cb(newResult);
                });
            }).catch(function(e){
                console.log(e);
            });
        }
    };

};
