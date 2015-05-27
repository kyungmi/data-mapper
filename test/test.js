/**
 * Created by kyungmi.koong on 2015-04-25.
 */

'use strict';

var assert  = require('assert');
var dataMapperConf = require('./conf/data-mapper-conf.json');
var dataMapper = require('./../lib/data-mapper').init(dataMapperConf);
var _ = require('lodash');
var userDao = dataMapper.dao('user');
var Transaction = dataMapper.Transaction;

describe('Use useDao', function () {
    describe('add and delete user', function () {
        it('add user', function (done) {
            userDao.addUser({id: 0, name: 'username', phone: '111-222-3333', isAdmin: 1}, function (err, result) {
                if (!err) {
                    assert.equal(result.affectedRows, 1);
                    assert.equal(result.insertId, 0);
                }
                done(err);
            });
        });
        it('delete user', function (done) {
            userDao.deleteUserById({id: 0}, function (err, result) {
                if (!err) {
                    assert.equal(result.affectedRows, 1);
                }
                done(err);
            });
        });
    });

    describe('use transaction', function () {
        var userId = 1;
        var updateUser = {id:userId, name: 'updatedUser', phone: 'updatephone', isAdmin: 0};
        var transaction = new Transaction([
            //userDao.deleteAllUser(),
            userDao.getUsers(),
            function(context, next){
                if(!_.isEmpty(context.getData(0))){
                    var maxUser = _.max(context.getData(0), function(user){
                        return user.id;
                    });
                    userId = maxUser.id + 1;
                    updateUser.id = userId;
                }
                userDao.addUser({id:userId, name:'newUser', phone: '12342321321312', isAdmin: 1}, function(err){
                    context.setData(userId);
                    next(err);
                }, context);
            },
            function(context, next) {
                userDao.modifyUser(updateUser, function(err/*, result*/){
                    next(err);
                }, context);
            }
        ]);
        it('user', function(done){
            transaction.start(function (err, context) {
                if (!err) {
                    userDao.getUserById({id: context.getData(1)}, function (err, result) {
                        assert.equal(result.length, 1);
                        assert.equal(result[0].id, updateUser.id);
                        assert.equal(result[0].name, updateUser.name);
                        assert.equal(result[0].phone, updateUser.phone);
                        assert.equal(result[0].is_admin, updateUser.isAdmin);
                        done(err);
                    });
                }
            });
        });
    });
});

//userDao.addUser({id: 0, name: 'username', phone: '111-222-3333'}, function(err, result){
//    if(err){
//        console.log('failed to add a user', err);
//    } else {
//        console.log('add successfully', result);
//        userDao.deleteUserById({id: 0}, function (err, result) {
//            if (err) {
//                console.log('failed to delete a user', err);
//            } else {
//                console.log('delete successfully', result);
//            }
//        });
//    }
//});

//var transaction = new Transaction([
//    //userDao.deleteAllUser(),
//    userDao.getUsers(),
//    function(connection, result, next){
//        var userId = 1;
//        if(!_.isEmpty(result)){
//            var maxUser = _.max(result, function(user){
//                return user.id;
//            });
//            userId = maxUser.id + 1;
//        }
//        userDao.addUser({id:userId, name:'newUser', phone: '12342321321312'}, connection, function(err, result){
//            next(err, connection, userId);
//        });
//    },
//    function(connection, userId, next) {
//        userDao.modifyUser({id:userId, name: 'updatedUser', phone: 'updatephone'}, connection, function(err, result){
//            next(err, connection, userId);
//        });
//    }
//]);
//transaction.start(function (err, userId) {
//    if (!err) {
//        userDao.getUserById({id: userId}, function (err, result) {
//            console.log('RESULT: ', result);
//        });
//    } else {
//        console.error(err);
//    }
//});