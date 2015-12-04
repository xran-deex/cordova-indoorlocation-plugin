var Helper = require('./helper');
module.exports = (function(){
    var self = this;
    var helper;
    var w;
    self._train = function(type, data, callback){
        var worker;
        switch(type){
            case 'nn':
                worker = 'js/workers/train.js';
                break;
            case 'knn':
                worker = 'js/workers/knn.js';
                break;
            case 'svm':
                worker = 'js/workers/svm.js';
                break;
            default:
                worker = 'js/workers/train.js';
        }
        if(!w) w = new Worker(worker);
        w.onmessage = callback;
        w.postMessage(data);
        return w;
    };

    self.train = function(){
        helper.train();
    };

    self.init = function(apikey){
        helper = new Helper();
        helper.init(apikey);
    };

    self.predict = function(interval, callback){
        helper.predict(interval, callback);
    };

    self.collect = function(name, callback){
        helper.export(name, callback);
    };

    self.stop = function(){
        helper.stop();
    };

    self.deleteDb = function() {
        helper.deleteDb();
    };

    self.deleteWifi = function(c){
        helper.deleteWifi(c);
    };

    return self;
})();
