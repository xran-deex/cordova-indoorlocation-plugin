/**
 *  @param e the event object
 */
onmessage = function(e){
    // todo - train data
    setTimeout(function(){
        postMessage('Received: ' + e.data + ' from train.js');
    }, 2000);
};
