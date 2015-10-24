


module.exports = (function(){
    var self = this;

    var w;
    self.train = function(type, data, callback){

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

    return self;
})();
