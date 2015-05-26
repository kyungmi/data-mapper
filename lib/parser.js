/**
 * Created by kyungmi.koong on 2015-05-26.
 */

function Parser(){

}

var states = {
    NONE: -1,
    TEXT: 1,
    START: 2,
    END: 3,
    DETERMINE: 4
};

var queryTypes = ['select', 'update', 'insert', 'delete'];

var specialChars = '{}#/';

var helperStart = /^\s*{#\s*(if|set|where|values)(\s+.*\s*)?}\s*$/;
var helperEnd = /^(.*){\/\s*(if|set|where|values)\s*}$/;

function Node(type, content, eval, params, parent){
    this.type = type;       // query, text, where, if, set
    this.content = content;
    this.eval = eval;
    this.params = params;
    this.parent = null;
    this.children = [];
}

Parser.prototype.parse = function(input){
    var length = input.length,
        root = null,
        currentChar,
        currentNode = root,
        context = {
            currentPos: 0,
            state: states.NONE,
            text: ''
        };

    var handlers = {
        'startQuery': function(queryType){
            currentNode = new Node('query', queryType);
        },
        'endQuery': function(context){

        },
        'startHelper': function(helperName, eval){
            var helperNode = new Node(helperName, null, eval, null, currentNode);
            currentNode.children.push(helperNode);
            currentNode = helperNode;
        },
        'endHelper': function(content, params){
            currentNode.content = content;
            currentNode.params = params;
            currentNode = currentNode.parent;
        },
        'text': function(content, params){
            currentNode.content = content;
            currentNode.params = params;
            currentNode = currentNode.parent;
        },
        'placeholder': function(context){

        }
    };

    while(context.currentPos < length){
        currentChar = input.charAt(context.currentPos++);
        context.text += currentChar;

        if(context.state === states.NONE && queryTypes.indexOf(context.text.toLowerCase()) > -1){
            handlers.startQuery(context.text.toLowerCase());
            context.state = states.TEXT;
        }

        if(currentChar === '{'){
            if(context.state === states.START){

            }
            context.state = states.DETERMINE;
        }

        if(currentChar === '}'){

        }

        if(context.state === states.DETERMINE && currentChar === '}'){
            var matched = helperStart.exec(context.text);
            if(matched !== null){
                handlers.startHelper(matched[1], matched[2].trim());
                context.state = states.START;
            } else {

            }
        }
    }
    return result;
};

module.exports = new Parser();