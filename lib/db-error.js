'use strict';

function DBException(error, msg){
    this.code = error.errno ? ('DB' + error.errno) : 'DB0000';
    this.originalError = error;
    this.msg = msg;
    //console.error('DB ERROR!', this);
}

module.exports = DBException;