'use strict';

function DBException(error){
    this.code = 'DB' + error.errno;
    this.originalError = error;
    //console.error('DB ERROR!', this);
}

module.exports = DBException;