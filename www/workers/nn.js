importScripts('../lib/convnet.min.js');

onmessage = function(msg){
    var layer_defs = [];
    // input layer of size 1x1x2 (all volumes are 3D)
    layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth:15});
    // some fully connected layers
    layer_defs.push({type:'fc', num_neurons:20, activation:'relu'});
    layer_defs.push({type:'fc', num_neurons:20, activation:'relu'});
    // a softmax classifier predicting probabilities for two classes: 0,1
    layer_defs.push({type:'softmax', num_classes:2});

    // create a net out of it
    var net = new convnetjs.Net();
    net.makeLayers(layer_defs);

    var trainer = new convnetjs.Trainer(net, {learning_rate:0.01, l2_decay:0.001}); 
};
