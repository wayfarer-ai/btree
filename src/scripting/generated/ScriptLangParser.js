// Generated from /Users/avinash.kumar/Documents/mine/btree/src/scripting/ScriptLang.g4 by ANTLR 4.13.1
// jshint ignore: start
import antlr4 from 'antlr4';
import ScriptLangListener from './ScriptLangListener.js';
import ScriptLangVisitor from './ScriptLangVisitor.js';

const serializedATN = [4,1,27,145,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,
4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,
2,13,7,13,2,14,7,14,2,15,7,15,1,0,5,0,34,8,0,10,0,12,0,37,9,0,1,0,1,0,1,
1,1,1,3,1,43,8,1,1,2,1,2,1,2,1,2,3,2,49,8,2,1,3,1,3,3,3,53,8,3,1,4,1,4,1,
5,1,5,1,5,5,5,60,8,5,10,5,12,5,63,9,5,1,6,1,6,1,6,5,6,68,8,6,10,6,12,6,71,
9,6,1,7,1,7,1,7,5,7,76,8,7,10,7,12,7,79,9,7,1,8,1,8,1,8,5,8,84,8,8,10,8,
12,8,87,9,8,1,9,1,9,1,9,5,9,92,8,9,10,9,12,9,95,9,9,1,10,1,10,1,10,5,10,
100,8,10,10,10,12,10,103,9,10,1,11,1,11,1,11,3,11,108,8,11,1,12,1,12,1,12,
5,12,113,8,12,10,12,12,12,116,9,12,1,13,1,13,1,13,1,13,1,13,1,13,1,13,1,
13,1,13,1,13,3,13,128,8,13,1,14,1,14,1,14,3,14,133,8,14,1,14,1,14,1,15,1,
15,1,15,5,15,140,8,15,10,15,12,15,143,9,15,1,15,0,0,16,0,2,4,6,8,10,12,14,
16,18,20,22,24,26,28,30,0,5,1,0,5,6,1,0,7,10,1,0,11,12,1,0,13,15,2,0,12,
12,16,16,148,0,35,1,0,0,0,2,42,1,0,0,0,4,44,1,0,0,0,6,50,1,0,0,0,8,54,1,
0,0,0,10,56,1,0,0,0,12,64,1,0,0,0,14,72,1,0,0,0,16,80,1,0,0,0,18,88,1,0,
0,0,20,96,1,0,0,0,22,107,1,0,0,0,24,109,1,0,0,0,26,127,1,0,0,0,28,129,1,
0,0,0,30,136,1,0,0,0,32,34,3,2,1,0,33,32,1,0,0,0,34,37,1,0,0,0,35,33,1,0,
0,0,35,36,1,0,0,0,36,38,1,0,0,0,37,35,1,0,0,0,38,39,5,0,0,1,39,1,1,0,0,0,
40,43,3,4,2,0,41,43,3,6,3,0,42,40,1,0,0,0,42,41,1,0,0,0,43,3,1,0,0,0,44,
45,5,25,0,0,45,46,5,1,0,0,46,48,3,8,4,0,47,49,5,2,0,0,48,47,1,0,0,0,48,49,
1,0,0,0,49,5,1,0,0,0,50,52,3,8,4,0,51,53,5,2,0,0,52,51,1,0,0,0,52,53,1,0,
0,0,53,7,1,0,0,0,54,55,3,10,5,0,55,9,1,0,0,0,56,61,3,12,6,0,57,58,5,3,0,
0,58,60,3,12,6,0,59,57,1,0,0,0,60,63,1,0,0,0,61,59,1,0,0,0,61,62,1,0,0,0,
62,11,1,0,0,0,63,61,1,0,0,0,64,69,3,14,7,0,65,66,5,4,0,0,66,68,3,14,7,0,
67,65,1,0,0,0,68,71,1,0,0,0,69,67,1,0,0,0,69,70,1,0,0,0,70,13,1,0,0,0,71,
69,1,0,0,0,72,77,3,16,8,0,73,74,7,0,0,0,74,76,3,16,8,0,75,73,1,0,0,0,76,
79,1,0,0,0,77,75,1,0,0,0,77,78,1,0,0,0,78,15,1,0,0,0,79,77,1,0,0,0,80,85,
3,18,9,0,81,82,7,1,0,0,82,84,3,18,9,0,83,81,1,0,0,0,84,87,1,0,0,0,85,83,
1,0,0,0,85,86,1,0,0,0,86,17,1,0,0,0,87,85,1,0,0,0,88,93,3,20,10,0,89,90,
7,2,0,0,90,92,3,20,10,0,91,89,1,0,0,0,92,95,1,0,0,0,93,91,1,0,0,0,93,94,
1,0,0,0,94,19,1,0,0,0,95,93,1,0,0,0,96,101,3,22,11,0,97,98,7,3,0,0,98,100,
3,22,11,0,99,97,1,0,0,0,100,103,1,0,0,0,101,99,1,0,0,0,101,102,1,0,0,0,102,
21,1,0,0,0,103,101,1,0,0,0,104,105,7,4,0,0,105,108,3,22,11,0,106,108,3,24,
12,0,107,104,1,0,0,0,107,106,1,0,0,0,108,23,1,0,0,0,109,114,3,26,13,0,110,
111,5,17,0,0,111,113,5,25,0,0,112,110,1,0,0,0,113,116,1,0,0,0,114,112,1,
0,0,0,114,115,1,0,0,0,115,25,1,0,0,0,116,114,1,0,0,0,117,128,5,23,0,0,118,
128,5,24,0,0,119,128,5,21,0,0,120,128,5,22,0,0,121,128,3,28,14,0,122,128,
5,25,0,0,123,124,5,18,0,0,124,125,3,8,4,0,125,126,5,19,0,0,126,128,1,0,0,
0,127,117,1,0,0,0,127,118,1,0,0,0,127,119,1,0,0,0,127,120,1,0,0,0,127,121,
1,0,0,0,127,122,1,0,0,0,127,123,1,0,0,0,128,27,1,0,0,0,129,130,5,25,0,0,
130,132,5,18,0,0,131,133,3,30,15,0,132,131,1,0,0,0,132,133,1,0,0,0,133,134,
1,0,0,0,134,135,5,19,0,0,135,29,1,0,0,0,136,141,3,8,4,0,137,138,5,20,0,0,
138,140,3,8,4,0,139,137,1,0,0,0,140,143,1,0,0,0,141,139,1,0,0,0,141,142,
1,0,0,0,142,31,1,0,0,0,143,141,1,0,0,0,15,35,42,48,52,61,69,77,85,93,101,
107,114,127,132,141];


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.atn.PredictionContextCache();

export default class ScriptLangParser extends antlr4.Parser {

    static grammarFileName = "ScriptLang.g4";
    static literalNames = [ null, "'='", "';'", "'||'", "'&&'", "'=='", 
                            "'!='", "'>'", "'<'", "'>='", "'<='", "'+'", 
                            "'-'", "'*'", "'/'", "'%'", "'!'", "'.'", "'('", 
                            "')'", "','", null, "'null'" ];
    static symbolicNames = [ null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, null, null, null, 
                             null, null, null, null, null, "BOOLEAN", "NULL", 
                             "NUMBER", "STRING", "IDENT", "WS", "COMMENT" ];
    static ruleNames = [ "program", "statement", "assignment", "expressionStatement", 
                         "expression", "logicalOr", "logicalAnd", "equality", 
                         "comparison", "additive", "multiplicative", "unary", 
                         "propertyAccess", "primary", "functionCall", "argumentList" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = ScriptLangParser.ruleNames;
        this.literalNames = ScriptLangParser.literalNames;
        this.symbolicNames = ScriptLangParser.symbolicNames;
    }



	program() {
	    let localctx = new ProgramContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, ScriptLangParser.RULE_program);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 35;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 65343488) !== 0)) {
	            this.state = 32;
	            this.statement();
	            this.state = 37;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 38;
	        this.match(ScriptLangParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	statement() {
	    let localctx = new StatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, ScriptLangParser.RULE_statement);
	    try {
	        this.state = 42;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,1,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 40;
	            this.assignment();
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 41;
	            this.expressionStatement();
	            break;

	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	assignment() {
	    let localctx = new AssignmentContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, ScriptLangParser.RULE_assignment);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 44;
	        this.match(ScriptLangParser.IDENT);
	        this.state = 45;
	        this.match(ScriptLangParser.T__0);
	        this.state = 46;
	        this.expression();
	        this.state = 48;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===2) {
	            this.state = 47;
	            this.match(ScriptLangParser.T__1);
	        }

	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	expressionStatement() {
	    let localctx = new ExpressionStatementContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, ScriptLangParser.RULE_expressionStatement);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 50;
	        this.expression();
	        this.state = 52;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===2) {
	            this.state = 51;
	            this.match(ScriptLangParser.T__1);
	        }

	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	expression() {
	    let localctx = new ExpressionContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, ScriptLangParser.RULE_expression);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 54;
	        this.logicalOr();
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	logicalOr() {
	    let localctx = new LogicalOrContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, ScriptLangParser.RULE_logicalOr);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 56;
	        this.logicalAnd();
	        this.state = 61;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===3) {
	            this.state = 57;
	            this.match(ScriptLangParser.T__2);
	            this.state = 58;
	            this.logicalAnd();
	            this.state = 63;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	logicalAnd() {
	    let localctx = new LogicalAndContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 12, ScriptLangParser.RULE_logicalAnd);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 64;
	        this.equality();
	        this.state = 69;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===4) {
	            this.state = 65;
	            this.match(ScriptLangParser.T__3);
	            this.state = 66;
	            this.equality();
	            this.state = 71;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	equality() {
	    let localctx = new EqualityContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 14, ScriptLangParser.RULE_equality);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 72;
	        this.comparison();
	        this.state = 77;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===5 || _la===6) {
	            this.state = 73;
	            _la = this._input.LA(1);
	            if(!(_la===5 || _la===6)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 74;
	            this.comparison();
	            this.state = 79;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	comparison() {
	    let localctx = new ComparisonContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 16, ScriptLangParser.RULE_comparison);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 80;
	        this.additive();
	        this.state = 85;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 1920) !== 0)) {
	            this.state = 81;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 1920) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 82;
	            this.additive();
	            this.state = 87;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	additive() {
	    let localctx = new AdditiveContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 18, ScriptLangParser.RULE_additive);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 88;
	        this.multiplicative();
	        this.state = 93;
	        this._errHandler.sync(this);
	        var _alt = this._interp.adaptivePredict(this._input,8,this._ctx)
	        while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	            if(_alt===1) {
	                this.state = 89;
	                _la = this._input.LA(1);
	                if(!(_la===11 || _la===12)) {
	                this._errHandler.recoverInline(this);
	                }
	                else {
	                	this._errHandler.reportMatch(this);
	                    this.consume();
	                }
	                this.state = 90;
	                this.multiplicative(); 
	            }
	            this.state = 95;
	            this._errHandler.sync(this);
	            _alt = this._interp.adaptivePredict(this._input,8,this._ctx);
	        }

	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	multiplicative() {
	    let localctx = new MultiplicativeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 20, ScriptLangParser.RULE_multiplicative);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 96;
	        this.unary();
	        this.state = 101;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while((((_la) & ~0x1f) === 0 && ((1 << _la) & 57344) !== 0)) {
	            this.state = 97;
	            _la = this._input.LA(1);
	            if(!((((_la) & ~0x1f) === 0 && ((1 << _la) & 57344) !== 0))) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 98;
	            this.unary();
	            this.state = 103;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	unary() {
	    let localctx = new UnaryContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 22, ScriptLangParser.RULE_unary);
	    var _la = 0;
	    try {
	        this.state = 107;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case 12:
	        case 16:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 104;
	            _la = this._input.LA(1);
	            if(!(_la===12 || _la===16)) {
	            this._errHandler.recoverInline(this);
	            }
	            else {
	            	this._errHandler.reportMatch(this);
	                this.consume();
	            }
	            this.state = 105;
	            this.unary();
	            break;
	        case 18:
	        case 21:
	        case 22:
	        case 23:
	        case 24:
	        case 25:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 106;
	            this.propertyAccess();
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	propertyAccess() {
	    let localctx = new PropertyAccessContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 24, ScriptLangParser.RULE_propertyAccess);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 109;
	        this.primary();
	        this.state = 114;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===17) {
	            this.state = 110;
	            this.match(ScriptLangParser.T__16);
	            this.state = 111;
	            this.match(ScriptLangParser.IDENT);
	            this.state = 116;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	primary() {
	    let localctx = new PrimaryContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 26, ScriptLangParser.RULE_primary);
	    try {
	        this.state = 127;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,12,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 117;
	            this.match(ScriptLangParser.NUMBER);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 118;
	            this.match(ScriptLangParser.STRING);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 119;
	            this.match(ScriptLangParser.BOOLEAN);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 120;
	            this.match(ScriptLangParser.NULL);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 121;
	            this.functionCall();
	            break;

	        case 6:
	            this.enterOuterAlt(localctx, 6);
	            this.state = 122;
	            this.match(ScriptLangParser.IDENT);
	            break;

	        case 7:
	            this.enterOuterAlt(localctx, 7);
	            this.state = 123;
	            this.match(ScriptLangParser.T__17);
	            this.state = 124;
	            this.expression();
	            this.state = 125;
	            this.match(ScriptLangParser.T__18);
	            break;

	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	functionCall() {
	    let localctx = new FunctionCallContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 28, ScriptLangParser.RULE_functionCall);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 129;
	        this.match(ScriptLangParser.IDENT);
	        this.state = 130;
	        this.match(ScriptLangParser.T__17);
	        this.state = 132;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) === 0 && ((1 << _la) & 65343488) !== 0)) {
	            this.state = 131;
	            this.argumentList();
	        }

	        this.state = 134;
	        this.match(ScriptLangParser.T__18);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	argumentList() {
	    let localctx = new ArgumentListContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 30, ScriptLangParser.RULE_argumentList);
	    var _la = 0;
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 136;
	        this.expression();
	        this.state = 141;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===20) {
	            this.state = 137;
	            this.match(ScriptLangParser.T__19);
	            this.state = 138;
	            this.expression();
	            this.state = 143;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}


}

ScriptLangParser.EOF = antlr4.Token.EOF;
ScriptLangParser.T__0 = 1;
ScriptLangParser.T__1 = 2;
ScriptLangParser.T__2 = 3;
ScriptLangParser.T__3 = 4;
ScriptLangParser.T__4 = 5;
ScriptLangParser.T__5 = 6;
ScriptLangParser.T__6 = 7;
ScriptLangParser.T__7 = 8;
ScriptLangParser.T__8 = 9;
ScriptLangParser.T__9 = 10;
ScriptLangParser.T__10 = 11;
ScriptLangParser.T__11 = 12;
ScriptLangParser.T__12 = 13;
ScriptLangParser.T__13 = 14;
ScriptLangParser.T__14 = 15;
ScriptLangParser.T__15 = 16;
ScriptLangParser.T__16 = 17;
ScriptLangParser.T__17 = 18;
ScriptLangParser.T__18 = 19;
ScriptLangParser.T__19 = 20;
ScriptLangParser.BOOLEAN = 21;
ScriptLangParser.NULL = 22;
ScriptLangParser.NUMBER = 23;
ScriptLangParser.STRING = 24;
ScriptLangParser.IDENT = 25;
ScriptLangParser.WS = 26;
ScriptLangParser.COMMENT = 27;

ScriptLangParser.RULE_program = 0;
ScriptLangParser.RULE_statement = 1;
ScriptLangParser.RULE_assignment = 2;
ScriptLangParser.RULE_expressionStatement = 3;
ScriptLangParser.RULE_expression = 4;
ScriptLangParser.RULE_logicalOr = 5;
ScriptLangParser.RULE_logicalAnd = 6;
ScriptLangParser.RULE_equality = 7;
ScriptLangParser.RULE_comparison = 8;
ScriptLangParser.RULE_additive = 9;
ScriptLangParser.RULE_multiplicative = 10;
ScriptLangParser.RULE_unary = 11;
ScriptLangParser.RULE_propertyAccess = 12;
ScriptLangParser.RULE_primary = 13;
ScriptLangParser.RULE_functionCall = 14;
ScriptLangParser.RULE_argumentList = 15;

class ProgramContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_program;
    }

	EOF() {
	    return this.getToken(ScriptLangParser.EOF, 0);
	};

	statement = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(StatementContext);
	    } else {
	        return this.getTypedRuleContext(StatementContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterProgram(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitProgram(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitProgram(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class StatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_statement;
    }

	assignment() {
	    return this.getTypedRuleContext(AssignmentContext,0);
	};

	expressionStatement() {
	    return this.getTypedRuleContext(ExpressionStatementContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AssignmentContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_assignment;
    }

	IDENT() {
	    return this.getToken(ScriptLangParser.IDENT, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterAssignment(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitAssignment(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitAssignment(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExpressionStatementContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_expressionStatement;
    }

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterExpressionStatement(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitExpressionStatement(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitExpressionStatement(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ExpressionContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_expression;
    }

	logicalOr() {
	    return this.getTypedRuleContext(LogicalOrContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterExpression(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitExpression(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitExpression(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LogicalOrContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_logicalOr;
    }

	logicalAnd = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(LogicalAndContext);
	    } else {
	        return this.getTypedRuleContext(LogicalAndContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterLogicalOr(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitLogicalOr(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitLogicalOr(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class LogicalAndContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_logicalAnd;
    }

	equality = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(EqualityContext);
	    } else {
	        return this.getTypedRuleContext(EqualityContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterLogicalAnd(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitLogicalAnd(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitLogicalAnd(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class EqualityContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_equality;
    }

	comparison = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ComparisonContext);
	    } else {
	        return this.getTypedRuleContext(ComparisonContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterEquality(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitEquality(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitEquality(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ComparisonContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_comparison;
    }

	additive = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(AdditiveContext);
	    } else {
	        return this.getTypedRuleContext(AdditiveContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterComparison(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitComparison(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitComparison(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class AdditiveContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_additive;
    }

	multiplicative = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(MultiplicativeContext);
	    } else {
	        return this.getTypedRuleContext(MultiplicativeContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterAdditive(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitAdditive(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitAdditive(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class MultiplicativeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_multiplicative;
    }

	unary = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(UnaryContext);
	    } else {
	        return this.getTypedRuleContext(UnaryContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterMultiplicative(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitMultiplicative(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitMultiplicative(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class UnaryContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_unary;
    }

	unary() {
	    return this.getTypedRuleContext(UnaryContext,0);
	};

	propertyAccess() {
	    return this.getTypedRuleContext(PropertyAccessContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterUnary(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitUnary(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitUnary(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PropertyAccessContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_propertyAccess;
    }

	primary() {
	    return this.getTypedRuleContext(PrimaryContext,0);
	};

	IDENT = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(ScriptLangParser.IDENT);
	    } else {
	        return this.getToken(ScriptLangParser.IDENT, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterPropertyAccess(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitPropertyAccess(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitPropertyAccess(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class PrimaryContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_primary;
    }

	NUMBER() {
	    return this.getToken(ScriptLangParser.NUMBER, 0);
	};

	STRING() {
	    return this.getToken(ScriptLangParser.STRING, 0);
	};

	BOOLEAN() {
	    return this.getToken(ScriptLangParser.BOOLEAN, 0);
	};

	NULL() {
	    return this.getToken(ScriptLangParser.NULL, 0);
	};

	functionCall() {
	    return this.getTypedRuleContext(FunctionCallContext,0);
	};

	IDENT() {
	    return this.getToken(ScriptLangParser.IDENT, 0);
	};

	expression() {
	    return this.getTypedRuleContext(ExpressionContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterPrimary(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitPrimary(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitPrimary(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class FunctionCallContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_functionCall;
    }

	IDENT() {
	    return this.getToken(ScriptLangParser.IDENT, 0);
	};

	argumentList() {
	    return this.getTypedRuleContext(ArgumentListContext,0);
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterFunctionCall(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitFunctionCall(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitFunctionCall(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}



class ArgumentListContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = ScriptLangParser.RULE_argumentList;
    }

	expression = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(ExpressionContext);
	    } else {
	        return this.getTypedRuleContext(ExpressionContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.enterArgumentList(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof ScriptLangListener ) {
	        listener.exitArgumentList(this);
		}
	}

	accept(visitor) {
	    if ( visitor instanceof ScriptLangVisitor ) {
	        return visitor.visitArgumentList(this);
	    } else {
	        return visitor.visitChildren(this);
	    }
	}


}




ScriptLangParser.ProgramContext = ProgramContext; 
ScriptLangParser.StatementContext = StatementContext; 
ScriptLangParser.AssignmentContext = AssignmentContext; 
ScriptLangParser.ExpressionStatementContext = ExpressionStatementContext; 
ScriptLangParser.ExpressionContext = ExpressionContext; 
ScriptLangParser.LogicalOrContext = LogicalOrContext; 
ScriptLangParser.LogicalAndContext = LogicalAndContext; 
ScriptLangParser.EqualityContext = EqualityContext; 
ScriptLangParser.ComparisonContext = ComparisonContext; 
ScriptLangParser.AdditiveContext = AdditiveContext; 
ScriptLangParser.MultiplicativeContext = MultiplicativeContext; 
ScriptLangParser.UnaryContext = UnaryContext; 
ScriptLangParser.PropertyAccessContext = PropertyAccessContext; 
ScriptLangParser.PrimaryContext = PrimaryContext; 
ScriptLangParser.FunctionCallContext = FunctionCallContext; 
ScriptLangParser.ArgumentListContext = ArgumentListContext; 
