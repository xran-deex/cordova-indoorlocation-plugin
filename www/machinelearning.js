
module.exports = (function(){
    var self = this;

    self.train = function(type, callback){
        var w;
        switch(type){
            case 'knn':
                w = new Worker('js/workers/knn.js');
                break;
            case 'svm':
                w = new Worker('js/workers/svm.js');
                break;
            default:
                w = new Worker('js/workers/train.js');
        }
        w.onmessage = callback;
        w.postMessage('Hello');
        return w;
    };

    return self;
})();
