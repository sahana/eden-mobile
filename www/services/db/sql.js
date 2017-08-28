/**
 * Sahana Eden Mobile - SQL Generator
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
 *
 * @todo: deprecate
 */

"use strict";

(function() {

    var refPattern = /reference\s+([a-z]{1}[a-z0-9_]*)(?:\.([a-z]{1}[a-z0-9_]*)){0,1}/gi;

    // ========================================================================
    /**
     * Helper function to quote SQL identifiers
     *
     * @param {string} identifier - the identifier
     *
     * @returns {string} - the quoted identifier
     */
    var quoted = function(identifier) {

        return '"' + identifier + '"';
    };

    // ========================================================================
    /**
     * SQLField constructor - helper class to generate SQL field expressions
     *
     * @param {Field} name - the field (emDB.Field instance)
     */
    function SQLField(field) {

        this.name = field.name;
        this.type = field.type;
        this.description = field._description;
    }

    // ------------------------------------------------------------------------
    /**
     * SQL expression to define a column in CREATE TABLE
     *
     * @returns {string} - the SQL expression
     */
    SQLField.prototype.define = function() {

        var fieldName = this.name,
            fieldType = this.type,
            description = this.description,
            sqlType = null,
            tableConstraints = [];

        refPattern.lastIndex = 0;
        var reference = refPattern.exec(fieldType);
        if (reference) {
            // @todo: ondelete-setting
            var lookupTable = reference[1],
                key = reference[2] || 'id',
                ondelete = description.ondelete || 'RESTRICT';
            tableConstraints.push('FOREIGN KEY (' + quoted(fieldName) + ') ' +
                                  'REFERENCES ' + lookupTable + '(' + quoted(key) + ') ' +
                                  'ON DELETE ' + ondelete);
            fieldType = 'reference';
        }

        // Determine the SQL field type
        switch(fieldType) {
            case 'id':
                sqlType = 'INTEGER PRIMARY KEY AUTOINCREMENT';
                break;
            case 'reference':
                sqlType = 'INTEGER';
                break;
            case 'string':
                sqlType = 'TEXT';
                break;
            case 'text':
                sqlType = 'TEXT';
                break;
            case 'boolean':
                sqlType = 'INTEGER';
                break;
            case 'integer':
                sqlType = 'INTEGER';
                break;
            case 'double':
                sqlType = 'REAL';
                break;
            case 'date':
                sqlType = 'TEXT';
                break;
            case 'time':
                sqlType = 'TEXT';
                break;
            case 'datetime':
                sqlType = 'TEXT';
                break;
            case 'json':
                sqlType = 'TEXT';
                break;
            case 'upload':
                sqlType = 'TEXT';
                break;
            default:
                sqlType = 'TEXT';
                break;
        }

        var columnDef = [quoted(this.name), sqlType];
        if (description.notnull) {
            columnDef.push('NOT NULL');
        }

        return {
            columnDef: columnDef.join(' '),
            tableConstraint: tableConstraints.join(',')
        };
    };

    // ========================================================================
    /**
     * SQLTable constructor - helper class to generate SQL table statements
     *
     * @param {string} table - the table (emDB.Table instance)
     */
    function SQLTable(table) {

        this.name = table.name;
        this.fields = table.fields;
    }

    // ------------------------------------------------------------------------
    /**
     * SQL statement to create the table
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.create = function() {

        var fields = this.fields,
            sqlField,
            sql,
            cols = [],
            tableConstraints = [];

        // Column definitions and table constraints
        for (var fieldName in fields) {

            sqlField = new SQLField(fields[fieldName]);
            sql = sqlField.define();

            if (sql.columnDef) {
                cols.push(sql.columnDef);
            }
            if (sql.tableConstraint) {
                tableConstraints.push(sql.tableConstraint);
            }
        }
        cols = cols.concat(tableConstraints).join(',');

        return 'CREATE TABLE IF NOT EXISTS ' + quoted(this.name) + ' (' + cols + ')';
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statement to drop the table
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.drop = function() {

        return 'DROP TABLE IF EXISTS ' + quoted(this.name);
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statement to insert new records
     *
     * @param {object} data - the data to insert, as {fieldname: value}
     *
     * @returns {Array} - an array of [SQLStatement, SQLValues]
     */
    SQLTable.prototype.insert = function(data) {

        var fields = this.fields,
            fieldName,
            field,
            sqlField,
            sqlValue,
            cols = [],
            values = [];

        // Collect and encode data
        for (fieldName in data) {
            if (fieldName[0] == '_') {
                // Processing instruction => skip
                continue;
            }
            field = fields[fieldName];
            if (field) {
                sqlValue = field.encode(data[fieldName]);
                if (sqlValue !== undefined) {
                    cols.push(quoted(field.name));
                    values.push(sqlValue);
                }
            }
        }

        // Construct SQL statement
        var placeholders = cols.map(col => '?').join(','),
            sql = [
                'INSERT INTO ' + quoted(this.name),
                '(' + cols.join(',') + ')',
                'VALUES (' + placeholders + ')'
            ];

        return [sql.join(' '), values];
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statement to update records
     *
     * @param {object} data - the data to update, as {fieldname: value}
     * @param {string} query - SQL WHERE expression
     *
     * @returns {Array} - and array of [SQLStatement, SQLValues]
     */
    SQLTable.prototype.update = function(data, query) {

        var fields = this.fields,
            fieldName,
            field,
            sqlField,
            sqlValue,
            cols = [],
            values = [];

        for (fieldName in data) {
            if (fieldName[0] == '_') {
                // Processing instruction => skip
                continue;
            }
            field = fields[fieldName];
            if (field) {
                sqlValue = field.encode(data[fieldName]);
                if (sqlValue !== undefined) {
                    cols.push(quoted(field.name));
                    values.push(sqlValue);
                }
            }
        }

        var placeholders = cols.map(col => col + '=?').join(','),
            sql = [
                'UPDATE ' + quoted(this.name),
                'SET ' + placeholders
            ];

        if (query) {
            sql.push('WHERE ' + query);
        }

        return [sql.join(' '), values];
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statements to select records
     *
     * @param {Array} fieldNames - array of field names
     * @param {query} query - an SQL query expression (WHERE)
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.select = function(fieldNames, query) {

        var where = query;
        if (typeof fieldNames === 'string') {
            where = fieldNames;
            fieldNames = query;
        }

        var tableName = this.name,
            cols = '*';
        if (fieldNames) {
            cols = fieldNames.map(col => tableName + '.' + col).join(',');
        }

        var sql = 'SELECT ' + cols + ' FROM ' + quoted(tableName);
        if (where) {
            sql += (' WHERE ' + where);
        }

        return sql;
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statement to count records
     *
     * @param {string} query - SQL WHERE expression
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.count = function(query) {

        var sql = 'SELECT COUNT(id) AS number FROM ' + quoted(this.name);
        if (query) {
            sql += (' WHERE ' + query);
        }

        return sql;
    };

    // ------------------------------------------------------------------------
    /**
     * SQL statements to delete records
     *
     * @param {string} query - SQL WHERE expression
     *
     * @returns {string} - the SQL statement
     */
    SQLTable.prototype.deleteRecords = function(query) {

        var sql = 'DELETE FROM ' + quoted(this.name);
        if (query) {
            sql += (' WHERE ' + query);
        }

        return sql;
    };

    // ------------------------------------------------------------------------
    /**
     * Convert a raw database record into a JS object
     *
     * @param {Array} fieldNames - list of field names
     * @param {object} item - the raw database record
     *
     * @return {object} - object with the converted record data
     */
    SQLTable.prototype.extract = function(fieldNames, item) {

        var fields = this.fields,
            fieldName;

        if (!fieldNames) {
            fieldNames = [];
            for (fieldName in fields) {
                fieldNames.push(fieldName);
            }
        }

        var jsData = {},
            field,
            sqlField,
            jsValue;

        fieldNames.forEach(function(fieldName) {

            var field = fields[fieldName];
            if (field) {
                if (item.hasOwnProperty(fieldName)) {
                    jsValue = field.decode(item[fieldName]);
                } else {
                    jsValue = null;
                }
                jsData[fieldName] = jsValue;
            }
        });

        return jsData;
    };

    // ========================================================================
    /**
     * emSQL - Service to generate SQL statements and expressions
     *
     * @class emSQL
     * @memberof EdenMobile
     */
    EdenMobile.factory('emSQL', [
        function () {

            var api = {

                /**
                 * Get an SQLField wrapper
                 *
                 * @param {Field} field - the emDB Field
                 */
                Field: function(field) {
                    return new SQLField(field);
                },

                /**
                 * Get an SQLTable wrapper
                 *
                 * @param {Table} table - the emDB Table
                 */
                Table: function(table) {
                    return new SQLTable(table);
                }
            };
            return api;
        }
    ]);

})();

// END ========================================================================