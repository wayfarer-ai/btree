grammar ScriptLang;

// Entry point - program consists of multiple statements
program
    : statement* EOF
    ;

// Statements - assignments or standalone expressions
statement
    : assignment
    | expressionStatement
    ;

// Assignment: variable = expression
assignment
    : IDENT '=' expression ';'?
    ;

// Expression statement (for evaluation without assignment)
expressionStatement
    : expression ';'?
    ;

// Expression hierarchy with proper precedence (lowest to highest)

// Logical OR (lowest precedence)
expression
    : logicalOr
    ;

logicalOr
    : logicalAnd ('||' logicalAnd)*
    ;

// Logical AND
logicalAnd
    : equality ('&&' equality)*
    ;

// Equality operators
equality
    : comparison (('==' | '!=') comparison)*
    ;

// Comparison operators
comparison
    : additive (('>' | '<' | '>=' | '<=') additive)*
    ;

// Addition and subtraction
additive
    : multiplicative (('+' | '-') multiplicative)*
    ;

// Multiplication, division, modulo
multiplicative
    : unary (('*' | '/' | '%') unary)*
    ;

// Unary operators (!, -)
unary
    : ('!' | '-') unary
    | propertyAccess
    ;

// Property access (object.property)
propertyAccess
    : primary ('.' IDENT)*
    ;

// Primary expressions (highest precedence)
primary
    : NUMBER
    | STRING
    | BOOLEAN
    | NULL
    | functionCall
    | IDENT
    | '(' expression ')'
    ;

// Function calls
functionCall
    : IDENT '(' argumentList? ')'
    ;

// Function arguments
argumentList
    : expression (',' expression)*
    ;

// Lexer rules

// Boolean literals
BOOLEAN
    : 'true'
    | 'false'
    ;

// Null literal
NULL
    : 'null'
    ;

// Numbers (integers and decimals)
NUMBER
    : [0-9]+ ('.' [0-9]+)?
    ;

// Strings (single or double quotes)
STRING
    : '"' (~["\r\n\\] | '\\' .)* '"'
    | '\'' (~['\r\n\\] | '\\' .)* '\''
    ;

// Identifiers (variable names)
IDENT
    : [a-zA-Z_][a-zA-Z0-9_]*
    ;

// Whitespace (skip)
WS
    : [ \t\r\n]+ -> skip
    ;

// Comments (skip)
COMMENT
    : '//' ~[\r\n]* -> skip
    ;

