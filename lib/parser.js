/**
 * Created by kyungmi.koong on 2015-05-26.
 */

var queryTypes = ['select', 'update', 'insert', 'delete'];

var queryStart = /^\s*(select|update|insert|delete)\s*$/i;
var helperStart = /^\s*{#\s*(if|set|where|values)(\s+.*\s*)?}\s*$/;
var helperEnd = /^\s*{\/\s*(if|set|where|values)\s*}$/;
var placeholder = /^\s*{{\s*([\w\.\[\]+\-\/\*\s]*)\s*}}$/;

function Node(type, content, eval, params, parent){
    this.type = type;
    this.content = content;
    this.eval = eval;
    this.params = params;
    this.parent = parent;
    this.children = [];
}

function ParseError(input, position, expectation, reason){
    this.input = input;
    this.position = position;
    this.expectation = expectation;
    this.reason = reason;
    this.message = this.reason + ': ' + '(expected: ' + this.expectation.join(', ') + ')' + '\n'
        + this.input + ' (pos: ' + this.position + ')';
}
ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.constructor = ParseError;

function Parser(){}

Parser.prototype.parse = function(input){
    var length = input.length,
        root = null,
        currentNode = null,
        context = {
            currentPos: 0,
            currentChar: '',
            text: '',
            startQuery: false
        },
        stack = new Array();

    var handlers = {
        'startQuery': function(queryType){
            root = new Node('query', queryType);
            currentNode = root;
        },
        'endQuery': function(content){
            if(content) {
                currentNode.children.push(new Node('text', content, null, null, currentNode));
            }
        },
        'startHelper': function(helperName, eval){
            var helperNode = new Node(helperName, null, eval, null, currentNode);
            currentNode.children.push(helperNode);
            currentNode = helperNode;
        },
        'endHelper': function(helperName){
            currentNode = currentNode.parent;
        },
        'text': function(content){
            if(content) {
                currentNode.children.push(new Node('text', content, null, null, currentNode));
            }
        },
        'placeholder': function(content, eval){
            currentNode.children.push(new Node('placeholder', content, eval, null, currentNode));
        }
    };

    while(context.currentPos < length){
        context.currentChar = input.charAt(context.currentPos++);
        context.text += context.currentChar;

        if(!context.startQuery && context.text.length > 5){
            var matched = queryStart.exec(context.text);
            if(matched !== null) {
                handlers.startQuery(matched[1].toLowerCase());
                context.startQuery = true;
            }
        }

        if (context.currentChar === '{') {
            if(!context.startQuery){
                throw new ParseError(input, context.currentPos - 1, ['select', 'update', 'insert', 'delete'],
                    'unexpected \'{\'');
            }
            if(context.text.length > 1){
                var text = context.text.substring(0, context.text.length - 1).trim();
                if(text) {
                    handlers.text(text);
                }
                context.text = '{';
            }
            if(context.currentPos < length) {
                var next = input.charAt(context.currentPos++);
                context.text += next;
                if(next === '#'){
                    context.type = 'helperStart';
                } else if(next === '/'){
                    context.type = 'helperEnd';
                } else if(next === '{') {
                    context.type = 'placeholder'
                } else {
                    throw new ParseError(input, context.currentPos - 1, ['#', '/', '{'],
                        'unexpected character: \'' + next + '\'');
                }
            } else {
                throw new ParseError(input, context.currentPos - 1, ['#', '/', '{'], 'unexpected end of string');
            }
        } else if (context.currentChar === '}') {
            if(!context.startQuery){
                throw new ParseError(input, context.currentPos - 1, ['select', 'update', 'insert', 'delete'],
                    'unexpected \'}\'');
            }
            if(context.type === 'placeholder'){
                if(context.currentPos < length){
                    var next = input.charAt(context.currentPos++);
                    context.text += next;
                    if(next === '}'){
                        var matched = placeholder.exec(context.text);
                        if(matched !== null){
                            handlers.placeholder(context.text, matched[1]);
                        } else {
                            throw new ParseError(input, context.currentPos - 1, ['{{...}}'],
                                'unexpected placeholder pattern: \'' + context.text + '\'');
                        }
                        context.text = '';
                    } else {
                        throw new ParseError(input, context.currentPos - 1, ['}'],
                            'unexpected character: \'' + next + '\'');
                    }
                } else {
                    throw new ParseError(input, context.currentPos - 1, ['}'], 'unexpected end of string');
                }
            } else if(context.type === 'helperStart'){
                // push to stack
                var matched = helperStart.exec(context.text);
                if(matched !== null){
                    stack.push({type: matched[1]});
                    var eval = matched[2] ? matched[2].trim() : undefined;
                    handlers.startHelper(matched[1], eval);
                } else {
                    throw new ParseError(input, context.currentPos - 1, ['{#...}'],
                        'unexpected helper start pattern: \'' + context.text + '\'');
                }
                context.text = '';
            } else if(context.type === 'helperEnd'){
                // pop from stack
                var matched = helperEnd.exec(context.text);
                var expectedHelperName = stack.pop().type;
                if(matched !== null){
                    if(expectedHelperName === matched[1]){
                        handlers.endHelper(matched[1]);
                    } else {
                        throw new ParseError(input, context.currentPos - 1, ['{/' + expectedHelperName + '}'],
                            'unexpected helper closing: \'' + context.text + '\'');
                    }
                } else {
                    throw new ParseError(input, context.currentPos - 1, ['{/' + expectedHelperName + '}'],
                        'unexpected helper end pattern: \'' + context.text + '\'');
                }
                context.text = '';
            } else {
                throw new ParseError(input, context.currentPos - 1, [], 'unexpected \'}\'');
            }
            context.type = '';
        }
    }
    if(!context.startQuery){
        throw new ParseError(input, context.currentPos - 1, ['select', 'update', 'insert', 'delete'], 'invalid query');
    } else {
        handlers.endQuery(context.text);
    }
    return root;
};

module.exports = new Parser().parse;


/*
function _test(){
    var testStr = 'SELECT * FROM\
        {#where}\
            {# if a=1} AND column_a >= {{a}} {/if}\
            {#if b} AND column_b = {{b}} {/if} \
            OR column_c = {{c.value}} \
        {/ where} GROUP BY column_a';
    var result =  module.exports.parse(testStr);
    console.log(result);
}
_test();*/
