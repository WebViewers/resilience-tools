var Mkdirp = require('mkdirp');
var Ncp = require('ncp');
var XMHell = require('xmhell');
var Fs = require('fs');
var Walk = require('walkdir');
var Archiver = require('archiver');
var FormData = require('form-data');
var Path = require('path');
var Http = require('http');

var LGPL = "\n" +
    " *\n" +
    " * See the NOTICE file distributed with this work for additional\n" +
    " * information regarding copyright ownership.\n" +
    " *\n" +
    " * This is free software; you can redistribute it and/or modify it\n" +
    " * under the terms of the GNU Lesser General Public License as\n" +
    " * published by the Free Software Foundation; either version 2.1 of\n" +
    " * the License, or (at your option) any later version.\n" +
    " *\n" +
    " * This software is distributed in the hope that it will be useful,\n" +
    " * but WITHOUT ANY WARRANTY; without even the implied warranty of\n" +
    " * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU\n" +
    " * Lesser General Public License for more details.\n" +
    " *\n" +
    " * You should have received a copy of the GNU Lesser General Public\n" +
    " * License along with this software; if not, write to the Free\n" +
    " * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA\n" +
    " * 02110-1301 USA, or see the FSF site: http://www.fsf.org.\n" +
    " *\n";

var project = {
  "modelVersion": "4.0.0",
  "groupId": "org.xwiki.contrib",
  "packaging": "pom",
  "artifactId": function() { throw new Error("artifactId missing"); },
  "name": function() { throw new Error("name missing"); },
  "version": "1.0",
  "build": {
    "plugins": {
      "plugin": {
        "artifactId": "maven-assembly-plugin",
        "version": "2.2-beta-5",
        "configuration": {
          "descriptors": {
            "descriptor": "src/main/assembly/assembly.xml"
          }
        },
        "executions": {
          "execution": {
            "id": "make-assembly",
            "phase": "install",
            "goals": {
              "goal": "single"
            }
          }
        }
      }
    }
  }
};

var pomXML = {
  "#COMMENT": LGPL
};
pomXML['project xmlns="http://maven.apache.org/POM/4.0.0" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
  'xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 ' +
  'http://maven.apache.org/maven-v4_0_0.xsd"'] = project;

var assemblyXML = {};
assemblyXML['assembly xmlns="http://maven.apache.org/plugins/maven-assembly-plugin/assembly/1.1.0" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
  'xsi:schemaLocation="http://maven.apache.org/plugins/maven-assembly-plugin/assembly/1.1.0 ' +
  'http://maven.apache.org/xsd/assembly-1.1.0.xsd"'] =
{
  "id": "bin",
  "baseDirectory": "/",
  "formats": {
    "format": "zip"
  },
  "fileSets": {
    "fileSet": {
      "directory": "src/main/resources",
      "outputDirectory": ""
    }
  }
}

module.exports.genMvn = function(gadgetDir, outDir) {
  Fs.readFile(gadgetDir + '/../package.json', function(err, content) {
    if (err) { throw err; }
    var json = JSON.parse(content);
    project.artifactId = "xwiki-contrib-" + json.name;
    project.name = json.name;
    project.description = json.description;
    project.version = json.version;

    Mkdirp(outDir+'/src/main/resources', function (err) {
      if (err) { throw err; }
      Ncp(gadgetDir, outDir+'/src/main/resources', function (err) {
        if (err) { throw err; }
      });
      Ncp(gadgetDir + '/../package.json', outDir+'/src/main/resources/package.json', function (err) {
        if (err) { throw err; }
      });

      pom = '';
      XMHell.write(pomXML, {write:function(x){ pom += x}}, function() {
        Fs.writeFile(outDir+'/pom.xml', pom);
      });
    });

    Mkdirp(outDir+'/src/main/assembly', function (err) {
      if (err) { throw err; }
      asm = '';
      XMHell.write(assemblyXML, {write:function(x){ asm += x}}, function() {
        Fs.writeFile(outDir+'/src/main/assembly/assembly.xml', asm);
      });
    });
  });
};

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


var doWithFormToken = function(userPass, host, port, path, callback) {

  var options = {
    host: host,
    path: path,
    port: port,
    auth: userPass
  };

  Http.request(options, function(response) {

    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      str.replace(/<meta name="form_token" content="([^"]*)"/, function(l, t) {
          callback(t);
          callback = function(){};
      });
    });
  }).end();
};

module.exports.postToXWiki = function(gadgetDir, postCmd, callback) {

  var userPass = postCmd.split('@')[0];
  var url = postCmd.split('@')[1];
  var host = url.split(':')[0].split(':')[0];
  var port = (url.split(':')[1] || '80').split('/')[0];
  var path = url.replace(url.split('/')[0], '');

  console.log("url:"+url);
  console.log("host:"+host);
  console.log("port:"+port);
  console.log("path:"+path);
  console.log("userPass:"+userPass);

  doWithFormToken(userPass, host, port, path.replace(/upload/, 'view'), function(token) {
    module.exports.genZip(gadgetDir, function(zip) {
      var form = new FormData();

      form.append('filepath', Fs.createReadStream(zip));
      form.append('form_token', token);
      form.submit({
        host: host,
        port: port,
        path: path,
        auth: userPass
      }, function(err, res) {
        if (err) { throw err; }
        callback();
        //console.log(res);
      });
    });
  });
};

module.exports.commandLine = function() {
  if (process.argv.indexOf('--mvn') > -1) {
    module.exports.genMvn('src', 'mvnout');

  } else if (process.argv.indexOf('--post') > -1) {
    var path = process.argv[process.argv.indexOf('--post') + 1];
    console.log("Posting to XWiki");
    module.exports.postToXWiki('src', path, function () {
      console.log('posting complete');
    });

  } else {
    module.exports.genZip('src', function() {
      console.log('done');
    });
  }
};
