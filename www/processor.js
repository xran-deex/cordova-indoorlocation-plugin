var API_URL = 'http://valis.strangled.net/locationtracker';
var BIT_CAP = 511;
/**
 *  @function decToBin - Converts a decimal to binary as an array of zeros and onDevicePaused
 *  @return {array} - an array of zeroes and ones
 */
var decToBin = function(dec, maxNum){
    var result = [];
    decToBinHelper(result, dec);
    // calculate the number of zeros to append. log of the bitcap rounded up
    var numZerosToAdd = Math.ceil(Math.log2(BIT_CAP)) - result.length;
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

var getCatArray = function(val, total){
    var result = [], i = 0;
    while(i < BIT_CAP){
        if(i == val){
            result.push(1);
        } else {
            result.push(-1);
        }
        i++;
    }
    return result;
};

/**
 *  @function addOrderNumToWifi
 *  Adds the order (in the data-set 1, 2, 3, 4)
 *  @param {array} wifi - the wifi ap list
 *  @param {number} idx - the order value
 *  @param {string} bssid - the item's bssid to add the order to.
 */
var addOrderNumToWifi = function(wifi, idx, bssid){
    var item = wifi.get(bssid);
    item.order =  idx;
};

var updateWifiOnServer = function(order, item){
    item.bssid.order = order;
    m.request({method:'put', data: item.bssid, url:API_URL+'/wifi?apikey='+item.bssid.apikey}).then(function(res){
        console.log(res);
    });
};

module.exports = {
    /**
     *  @function save_ssid - saves the list of wifi access point information to the server
     *  @param {array} list - the list of wifi hotspots
     *  @param {object} current_wifi_list - the current list of wifi hotspots downloaded from the server
     *  @param {string} apikey - the api key
     */
    save_ssid: function(list, current_wifi_list, apikey){
        'use strict';
        if(!list) return;

        var count = current_wifi_list.size;
        var orig = count;

        var new_access_point_data = [];
        for(let i of current_wifi_list.values()){
            if(!i.apikey){
                count++;
                i.apikey = apikey;
                new_access_point_data.push(i);
            }
        }
        // only make a web request if there are new bssids
        if(count > orig) {
            m.request({method:'post', data: new_access_point_data, url:API_URL+'/wifi?apikey='+apikey}).then(function(res){
                console.log(res);
            });
        }
    },
    constructInputData: function(wifi, model, vm, cb){
        'use strict';

        var result = [], maxItems = BIT_CAP;
        var wifi_count = wifi.size;
        model.wifi.forEach(function(item){
            if(!wifi.has(item.BSSID)) {
                wifi.set(item.BSSID, {name: item.BSSID, count: ++wifi_count});
            }
        });
        model.wifi.forEach(function(item){
            wifi.forEach(function(i){
                if(i.name === item.BSSID){
                    result.push({bssid: i, signal: item});
                }
            });
        });
        result.sort(function(ii, jj){
            return ii.bssid.count - jj.bssid.count;
        });
        var newResult = [];
        var num_added = 0;
        result.forEach(function(item, idx){
            if(item.bssid.count > BIT_CAP) return;
            if(num_added < 4){
                var bin = decToBin(item.bssid.count, maxItems);
                bin.forEach(function(i){
                    newResult.push(i);
                });
                newResult.push((item.signal.Level + 100) / 100);
                num_added++;
            }
        });

        newResult.push((model.lat + 85) / 170);
        newResult.push((model.lng + 180) / 360);
        newResult.push((model.magnetic_field[0] + 180) / 360);
        newResult.push((model.magnetic_field[1] + 180) / 360);
        newResult.push((model.magnetic_field[2] + 180) / 360);
        cb(newResult);
    }
};
