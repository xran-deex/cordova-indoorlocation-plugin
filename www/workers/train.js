importScripts('../lib/bower_components/synaptic/src/trainer.js', '../lib/bower_components/synaptic/src/neuron.js', '../lib/bower_components/synaptic/src/layer.js', '../lib/bower_components/synaptic/src/network.js', '../lib/bower_components/synaptic/src/architect.js');
/**
 *  @param e the event object
 */

var network, trainer, _abort = false, ws;

onmessage = function(e){
    if(e.data.action === 'train'){
        if(e.data.network){
            var json;
            if(typeof e.data.network == 'string'){
                json = JSON.parse(e.data.network);
            } else {
                json = e.data.network;
            }
            network = Network.fromJSON(json);
            postMessage('Network restored');
            return;
        }
        var training_ids = e.data.data.map(function(item){
            return item.training_id;
        }).filter(function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        });
        var map = {};
        training_ids.forEach(function(i, index){
            map[i] = index;
        });
        var numTrainingIds = training_ids.length;
        var training_set = e.data.data.map(function(item){
            // create an array of length numTrainingIds and set it to all zeros
            var out = Array.apply(null, Array(numTrainingIds)).map(Number.prototype.valueOf,0);
            // now set this training id to 1.
            out[map[item.training_id]] = 1;
            return {
                input: item.data,
                output: out
            };
        });

        if(!e.data.local){
            ws = new WebSocket('ws://valis.strangled.net/locationtrackersocket');

            // monitor progress messages from the server
            ws.onmessage = function(event){
                var data = JSON.parse(event.data);
                if(data.log){
                    postMessage({log: data.log});
                }
                if(data.result){
                    network = Network.fromJSON(data.result.network);
                    postMessage({result: data.result.result, network: data.result.network});
                }
            };

            // create a post request to start the training
            var request = new Request('http://valis.strangled.net/locationtracker', {
                method: 'post',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(training_set)
            });

            // initiate a training request
            fetch(request);
        }

        if(e.data.local){
            network = new Architect.Perceptron(29, 29, numTrainingIds);
            trainer = new Trainer(network);
            var training_result = trainer.train(training_set, {
                rate: 0.1,
                iterations: 20000,
                error: 0.005,
                log: 100,
                cost: Trainer.cost.CROSS_ENTROPY,
                schedule: {
                    every: 10,
                    do: function(data) {
                        postMessage({log:data});
                        if(_abort){
                            postMessage({log: 'Aborting'});
                            _abort = false;
                            network = null;
                            return true;
                        }
                    }
                }
            });
            if(!_abort)
                postMessage({result: training_result, network: network.toJSON()});
        }
    }

    if(e.data.action === 'abort'){
        _abort = true;
        if(ws){
            ws.close();
            ws = null;
        }
    }

    if(e.data.action === 'predict'){
        // if the action is to predict, just activate the network with the data and post the result
        var result = network.activate(e.data.data);
        postMessage(result);
    }
};
