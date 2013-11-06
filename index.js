/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 */
var XMHell = require('xmhell');
var Fs = require('fs');
var Walk = require('walkdir');
var Archiver = require('archiver');
var Path = require('path');

module.exports.genZip = function(dir, callback) {
  var gadgetDir = Path.resolve(dir);
  var zip;
  var zipName;
  var workers = 0;
  var stop = function() {
    if (workers && --workers) { return; }
    zip.finalize(function() { callback(zipName); });
    zip = undefined;
  };

  Fs.readFile(gadgetDir + '/../package.json', function(err, content) {
    if (err) { throw err; }
    var json = JSON.parse(content);
    zipName = json.name + '-' + json.version + '.zip';
    if (Fs.existsSync(zipName)) {
      console.log('Deleting ' + zipName);
      Fs.unlinkSync(zipName);
    }

    zip = new Archiver.createZip({ level: 1 });
    zip.pipe(Fs.createWriteStream(zipName));

    var w = Walk(gadgetDir);
    var files = [];
    files.push({getData:function(cb) { cb(undefined, content) }, name:'package.json' });
    w.on('file', function(path) {
      var name = path.replace(gadgetDir + '/', '');
      files.push({getData:function(cb) { Fs.readFile(path, cb); }, name:name});
    });

    w.on('end', function() {
      workers += files.length;
      files.forEach(function(file) {
        file.getData(function(err, data) {
          if (err) { throw err; }
          zip.addFile(data, { name: file.name }, function() {
            console.log(file.name + " Complete");
            stop();
          });
        });
      });
    });

  });
};

module.exports.commandLine = function() {
  module.exports.genZip('src', function() {
    console.log('done');
  });
};
