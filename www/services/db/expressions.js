/**
 * Sahana Eden Mobile - SQL Expressions
 *
 * Copyright (c) 2016-2017: Sahana Software Foundation
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

"use strict";

(function() {

    // ========================================================================
    /**
     * SQL Expressions - Constructor
     *
     * @param {string} exprType - the expression type
     * @param {Expression} left - the left operand
     * @param {string} op - the operator
     * @param {Expression} right - the right operand
     */
    function Expression(exprType, left, op, right) {

        if (!left) {
            throw new Error('left operand required');
        }
        if (!op) {
            throw new Error('operator required');
        }

        switch (exprType) {
            case 'assert':
            case 'transform':
            case 'aggregate':
            case 'join':

                this.op = op;
                this.left = left;
                this.right = right;

                Object.defineProperty(this, 'exprType', {
                    value: exprType,
                    writable: false
                });
                break;

            default:
                throw new Error('unsupported expression type: ' + exprType);
                break;
        }
    }

    // ------------------------------------------------------------------------
    /**
     * Connectives (logical operators)
     *
     * @example
     *  expression.and(otherExpression)
     */
    Expression.prototype._connective = function(op, other) {

        var expr;

        if (!other) {
            expr = this;
        } else if (other.exprType != 'assert') {
            throw new Error('invalid expression type for "' + op + '"');
        } else {
            switch (this.exprType) {
                case 'assert':
                    expr = new Expression('assert', this, op, other);
                    break;
                default:
                    throw new Error('invalid expression type for "' + op + '"');
                    break;
            }
        }
        return expr;
    };

    Expression.prototype.and = function(other) {
        return this._connective('and', other);
    };
    Expression.prototype.or = function(other) {
        return this._connective('or', other);
    };
    Expression.prototype.not = function() {
        return this._connective('not', this);
    };

    // ------------------------------------------------------------------------
    /**
     * Assertions
     *
     * @example
     *  field.equals(value)
     */
    Expression.prototype._assert = function(op, other) {

        var expr;

        if (other === undefined) {
            throw new Error('missing operand');
        } else {
            switch (this.exprType) {
                case 'field':
                case 'transform':
                case 'aggregate':
                    expr = new Expression('assert', this, op, other);
                    break;
                default:
                    throw new Error('invalid operand type for "' + op + '" assertion');
                    break;
            }
        }
        return expr;
    };

    Expression.prototype.equals = function(other) {
        return this._assert("=", other);
    };
    Expression.prototype.notEqual = function(other) {
        return this._assert("!=", other);
    };
    Expression.prototype.lessThan = function(other) {
        return this._assert("<", other);
    };
    Expression.prototype.lessOrEqual = function(other) {
        return this._assert("<=", other);
    };
    Expression.prototype.greaterOrEqual = function(other) {
        return this._assert(">=", other);
    };
    Expression.prototype.greaterThan = function(other) {
        return this._assert(">", other);
    };
    Expression.prototype.like = function(other) {
        return this._assert("like", other);
    };

    // ------------------------------------------------------------------------
    /**
     * Transformation functions
     *
     * @example
     *  field.upper()
     */
    Expression.prototype._transform = function(op) {

        var expr;

        switch (this.exprType) {
            case 'field':
            case 'transform':
                expr = new Expression('transform', this, op);
                expr.decode = this.decode;
                break;
            default:
                throw new Error('invalid type for "' + op + '" transformation');
                break;
        }
        return expr;
    };

    Expression.prototype.upper = function() {
        return this._transform('upper');
    };
    Expression.prototype.lower = function() {
        return this._transform('lower');
    };

    // ------------------------------------------------------------------------
    /**
     * Aggregation functions
     *
     * @example
     *  field.count()
     */
    Expression.prototype._aggregate = function(op) {

        var expr;

        switch (this.exprType) {
            case 'field':
                expr = new Expression('aggregate', this, op);
                expr.decode = this.decode;
                break;
            default:
                throw new Error('invalid type for "' + op + '" aggregation');
                break;
        }
        return expr;
    };

    Expression.prototype.min = function() {
        return this._aggregate('min');
    };
    Expression.prototype.max = function() {
        return this._aggregate('max');
    };
    Expression.prototype.count = function() {
        return this._aggregate('count');
    };
    Expression.prototype.avg = function() {
        return this._aggregate('avg');
    };
    Expression.prototype.sum = function() {
        return this._aggregate('sum');
    };

    // ------------------------------------------------------------------------
    /**
     * Provide a string representation of this expression
     *
     * @returns {string} - a string representation of this expression
     */
    Expression.prototype.toString = function() {
        return this.toSQL();
    };

    // ------------------------------------------------------------------------
    /**
     * SQL construction
     *
     * @returns {string} - this expression as SQL string
     */
    Expression.prototype.toSQL = function() {

        var sqlStr,
            op = this.op,
            left = this.left,
            right = this.right,
            lSql = left.toSQL(),
            rSql;

        switch (op) {
            case 'and':
            case 'or':
                rSql = right.toSQL();
                sqlStr = '(' + lSql + ') ' + op.toUpperCase() + ' (' + rSql + ')';
                break;
            case '=':
            case '!=':
            case '<':
            case '<=':
            case '>=':
            case '>':
            case 'like':
                if (typeof right.toSQL == 'function') {
                    rSql = right.toSQL();
                } else {
                    if (typeof left.sqlEncode == 'function') {
                        rSql = left.sqlEncode(right);
                    } else {
                        rSql = "'" + ('' + right).replace(/'/g, "''") + "'";
                    }
                }
                sqlStr = [lSql, op, rSql].join(' ');
                break;
            case 'upper':
            case 'lower':
            case 'min':
            case 'max':
            case 'avg':
            case 'sum':
            case 'count':
                sqlStr = op.toUpperCase() + '(' + leftSql + ')';
                break;
            case 'on':
                sqlStr = '' + left + ' ON ' + right.toSQL();
                break;
            default:
                throw new Error('unknown operator "' + this.op + '"');
        }

        return sqlStr;
    };

    // ------------------------------------------------------------------------
    /**
     * Get a column alias for this expression
     *
     * @param {Set} set - the Set the column is extracted from
     *
     * @returns {string} - the column alias
     */
    Expression.prototype.columnAlias = function(set) {

        var alias;

        switch (this.exprType) {
            case 'transform':
            case 'aggregate':
                var leftAlias = this.left.columnAlias(set);
                if (leftAlias) {
                    alias = this.op.toUpperCase() + '(' + leftAlias + ')';
                }
                break;
            default:
                throw new Error('invalid expression type');
                break;
        }
        return alias;
    };

    // ------------------------------------------------------------------------
    /**
     * Extract a value for this expression from a query result row
     *
     * @param {Set} set - the set the row has been selected from
     * @param {object} row - the result row (an item returned by executeSql)
     *
     * @returns {mixed} - the value for this expression from the row
     */
    Expression.prototype.extract = function(set, row) {

        var alias = this.columnAlias(set),
            value;

        if (row.hasOwnProperty(alias)) {
            value = row[alias];
        }
        if (value !== undefined && this.decode) {
            value = this.decode(value);
        }
        return value;
    };

    // ------------------------------------------------------------------------
    // Make injectable
    angular.module('EdenMobile').constant('Expression', Expression);

})();

// ============================================================================
// Global helper functions for query constructions
//
/**
 * NOT - negate an expression
 *
 * @returns {Expression} - the negated expression
 */
var not = function(expr) {

    return expr.not();
};

// ----------------------------------------------------------------------------
/**
 * AND - conjunction of expressions
 *
 * @returns {Expression} - a conjunction expression
 */
var allOf = function() {

    // @todo: accept+resolve arrays of expressions

    if (!arguments.length) {
        throw new Error('allOf: missing arguments');
    }

    var args = [].slice.call(arguments);

    return args.reduce(function(left, right) {

        return left.and(right);
    });
};

// ----------------------------------------------------------------------------
/**
 * OR - disjunction of expressions
 *
 * @returns {Expression} - a disjunction expression
 */
var anyOf = function() {

    // @todo: accept+resolve arrays of expressions

    if (!arguments.length) {
        throw new Error('anyOf: missing arguments');
    }

    var args = [].slice.call(arguments);

    return args.reduce(function(left, right) {
        return left.or(right);
    });
};

// END ========================================================================
