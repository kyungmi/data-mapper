/**
 * Created by kyungmi.koong on 2015-04-24.
 */

'use strict';


var connectors = {};
var defaultConnector;

module.exports.init = function(connectorOption){
    for (var connectorName in connectorOption) {
        if (connectorOption.hasOwnProperty(connectorName)) {
            var options = connectorOption[connectorName];
            var Connector = require('./connectors/' + options.type + '-connector');
            if(Connector) {
                var isDefault = options.default;
                delete options.type;
                delete options.default;
                var connector = new Connector(options);
                if(isDefault){
                    defaultConnector = connector;
                }
                connectors[connectorName] = connector;
            } else {
                console.warn('\'' + options.type + '\' connector type is not exist.');
            }
        }
    }
};

module.exports.getConnector = function(connectorName) {
    return (connectorName) ? (connectors[connectorName] || defaultConnector) : defaultConnector;
};


