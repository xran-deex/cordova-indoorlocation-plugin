var Helper = require('./helper');
module.exports = (function(){
    var self = this;
    var helper;
    var w;
    self._train = function(type, data, callback){

        switch(type){
            case 'knn':
                w = new Worker('js/workers/knn.js');
                break;
            case 'svm':
                w = new Worker('js/workers/svm.js');
                break;
            default:
                if(!w)
                w = new Worker('js/workers/train.js');
        }
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

    self.predict = function(callback){
        helper.predict(callback);
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

    return self;
})();
