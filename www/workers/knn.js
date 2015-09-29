/**
 *  @param e the event object
 */
onmessage = function(e){
    // todo - train data
    setTimeout(function(){
        postMessage('Received: ' + e.data + ' from knn.js');
    }, 2000);
};
