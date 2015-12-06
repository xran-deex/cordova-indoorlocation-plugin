module.exports = (function(){
    var self = this;
    var w;
    self.train = function(type, data, callback){
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
    return self;
})();
