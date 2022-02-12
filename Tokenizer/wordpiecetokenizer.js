"use strict";

var TrieNode = (function () {
    function TrieNode(key) {
        this.key = key;
        this.parent = null;
        this.children = {};
        this.end = false;
    }
    TrieNode.prototype.getWord = function () {
        var output = [];
        var node = null;
        while (node !== null) {
            if (node.key !== null) {
                output.unshift(node.key);
            }
            node = node.parent;
        }
        return [output, this.score, this.index];
    };
    return TrieNode;
}());
var Trie = (function () {
    function Trie() {
        this.root = new TrieNode(null);
    }
    Trie.prototype.insert = function (word, score, index) {
        var node = this.root;
        var symbols = [];
        for (var _i = 0, word_1 = word; _i < word_1.length; _i++) {
            var symbol = word_1[_i];
            symbols.push(symbol);
        }
        for (var i = 0; i < symbols.length; i++) {
            if (!node.children[symbols[i]]) {
                node.children[symbols[i]] = new TrieNode(symbols[i]);
                node.children[symbols[i]].parent = node;
            }
            node = node.children[symbols[i]];
            if (i === symbols.length - 1) {
                node.end = true;
                node.score = score;
                node.index = index;
            }
        }
    };
    Trie.prototype.find = function (ss) {
        var node = this.root;
        var iter = 0;
        while (iter < ss.length && node != null) {
            node = node.children[ss[iter]];
            iter++;
        }
        return node;
    };
    return Trie;
}());
var WordPieceTokenizer = (function () {
    function WordPieceTokenizer() {
        this.separator = '\u2581';
        this.UNK_INDEX = 100;
    }
    WordPieceTokenizer.prototype.load = function () {
        console.log("PATCHED OUT")
        this.vocab = window.tokens;
        this.trie = new Trie();
        this.trie.insert('[CLS]', 1, 101);
        this.trie.insert('[SEP]', 1, 102);
        for (var i = 999; i < this.vocab.length; i++) {
            var word = this.vocab[i];
            this.trie.insert(word, 1, i);
        }
    };
    WordPieceTokenizer.prototype.processInput = function (text) {
        var _this = this;
        var words = text.split(' ');
        return words.map(function (word) {
            if (word !== '[CLS]' && word !== '[SEP]') {
                return _this.separator + word.toLowerCase().normalize('NFKC');
            }
            return word;
        });
    };
    WordPieceTokenizer.prototype.tokenize = function (text) {
        var outputTokens = [];
        var words = this.processInput(text);
        for (var i = 0; i < words.length; i++) {
            var chars = [];
            for (var _i = 0, _a = words[i]; _i < _a.length; _i++) {
                var symbol = _a[_i];
                chars.push(symbol);
            }
            var isUnknown = false;
            var start = 0;
            var subTokens = [];
            var charsLength = chars.length;
            while (start < charsLength) {
                var end = charsLength;
                var currIndex = void 0;
                while (start < end) {
                    var substr = chars.slice(start, end).join('');
                    var match = this.trie.find(substr);
                    if (match != null && match.end) {
                        currIndex = match.getWord()[2];
                        break;
                    }
                    end = end - 1;
                }
                if (currIndex == null) {
                    isUnknown = true;
                    break;
                }
                subTokens.push(currIndex);
                start = end;
            }
            if (isUnknown) {
                outputTokens.push(this.UNK_INDEX);
            }
            else {
                outputTokens = outputTokens.concat(subTokens);
            }
        }
        return outputTokens;
    };
    return WordPieceTokenizer;
}());
window.WordPieceTokenizer = WordPieceTokenizer;
//# sourceMappingURL=wordpiecetokenizer.js.map