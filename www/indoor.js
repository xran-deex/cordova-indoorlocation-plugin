var Helper = require('./helper');
module.exports = (function(){
    var self = this;
    var helper;

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
