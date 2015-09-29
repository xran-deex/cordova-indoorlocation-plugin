importScripts('../lib/ml.js', '../lib/svm.js');
/**
 *  @param e the event object
 */
onmessage = function(e){
    // todo - train data
    setTimeout(function(){
        postMessage('Received: ' + e.data + ' from svm.js');
    }, 2000);

    var x = [[1,1,1,0,0,0],
         [1,0,1,0,0,0],
         [1,1,1,0,0,0],
         [0,0,1,1,1,0],
         [0,0,1,1,0,0],
         [0,0,1,1,1,0]];

    var y = [[1, 0],
             [1, 0],
             [1, 0],
             [0, 1],
             [0, 1],
             [0, 1]];

    var clf = new ml.LogisticRegression({
        'input' : x,
        'label' : y,
        'n_in' : 6,
        'n_out' : 2
    });

    clf.train({
        'lr' : 0.6,
        'epochs' : 2000
    });

    var test_x = [[1, 1, 0, 0, 0, 0],
              [0, 0, 0, 1, 1, 0],
              [1, 1, 1, 1, 1, 0]];

    var result = clf.predict(test_x);
    postMessage(result);
};
