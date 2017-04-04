'use strict';

var express = require('express'),
  bodyParser = require('body-parser'),
  Realm = require('realm'),
  credentials = require('./credentials');

var app = express();

var user = credentials.user;
var password = credentials.password;
var SERVER_URL = credentials.server;

var session = require('express-session');

let QuestionSchema = {
  name: 'Question',
  primaryKey: 'id',
  properties: {
    id: 'int',
    status: {type: 'bool', default: true},
    timestamp: 'date',
    question: 'string',
    author: {type: 'User'},
    vote: {type: 'list', objectType: 'User'},
    isAnswered: {type: 'bool', default: false},
  }
};

let UserSchema = {
  name: 'User',
  primaryKey: 'id',
  properties: {
    id: 'string'
  }
}

app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
  secret: 'realm questions',
  resave: false,
  saveUninitialized: false,
  cookie: {secure: false, maxAge: 24 * 60 * 60 * 1000}
}));

var handlebars = require('express-handlebars').create({
  helpers: {
    ifCond: function(v1, v2, options) {
      if(v1 === v2) {
        return options.fn(this);
      }
      return options.inverse(this);
    }
  },
  defaultLayout:'main'
});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.get('/', function(req, res) {
  var sess = req.session;
  if (!sess.author) {
    sess.author = gennuid()
  }

  Realm.Sync.User.login(SERVER_URL, user, password, (error, user) => {
    var syncRealm;

    if (!error) {
      var syncRealm = new Realm({
        sync: {
          user: user,
          url: 'realm://127.0.0.1:9080/~/question-realm',
        },
        schema: [QuestionSchema, UserSchema]
      });

      let questions = syncRealm.objects('Question').filtered('status = true').sorted('id', true);
      res.render('index', {currentUser: sess.author, questions: questions});
    } else {
      res.send(error.toString());
    }
  });
});

app.post('/', function(req, res) {
  Realm.Sync.User.login(SERVER_URL, user, password, (error, user) => {
    if (!error) {
      let syncRealm = new Realm({
        sync: {
          user: user,
          url: 'realm://127.0.0.1:9080/~/question-realm',
        },
        schema: [QuestionSchema, UserSchema]
      });

      let question = req.body['question'],
      qid = Number(req.body['qid']),
      timestamp = new Date()

      if (question) {
        syncRealm.write(() => {
          console.log("id: " + qid + "question: " + question)

          syncRealm.create('Question', {id: qid, question: question, timestamp: timestamp}, true)
        });
      } else {
        syncRealm.write(() => {
          console.log("delete" + "id: " + qid)

          syncRealm.create('Question', {id: qid, status: false, timestamp: timestamp}, true)
        });
      }
    }
  });

  res.sendFile(__dirname + "/write-complete.html");
});

app.get('/write', function(req, res) {
  res.sendFile(__dirname + "/write.html");
});

app.post('/write', function(req, res) {
  Realm.Sync.User.login(SERVER_URL, user, password, (error, user) => {
    if (!error) {
      var sess = req.session;
      if (!sess.author) {
        sess.author = gennuid()
      }

      let syncRealm = new Realm({
        sync: {
          user: user,
          url: 'realm://127.0.0.1:9080/~/question-realm',
        },
        schema: [QuestionSchema, UserSchema]
      });

      let question = req.body['question'],
      timestamp = new Date(),
      questions = syncRealm.objects('Question').sorted('id', true)
      let id = (questions.length == 0 ? 0 : questions[0].id + 1)

      var pred = 'id = "' + sess.author + '"'
      let newAuthor =  syncRealm.objects('User').filtered(pred)

      if (newAuthor.length == 0) {
        syncRealm.write(() => {
          console.log("author write")
          newAuthor = syncRealm.create('User', {id: sess.author}, true)
        });
      } else {
        newAuthor = newAuthor[0]
      }

      syncRealm.write(() => {
        console.log("question write")
        console.log("id: " + id + " author: " + newAuthor.id + "question: " + question);
        syncRealm.create('Question', {id: id, question: question, author: newAuthor, timestamp: timestamp})
      });
    }
  });

  res.sendFile(__dirname + "/write-complete.html");
});

app.listen(3000, function() {
  console.log("listening localhost:3000");
});

function gennuid() {
  return new Date().toLocaleTimeString() + Math.floor(Math.random() * 10000)
}

// handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
//     switch (operator) {
//         case '==':
//             return (v1 == v2) ? options.fn(this) : options.inverse(this);
//         case '===':
//             return (v1 === v2) ? options.fn(this) : options.inverse(this);
//         case '!=':
//             return (v1 != v2) ? options.fn(this) : options.inverse(this);
//         case '!==':
//             return (v1 !== v2) ? options.fn(this) : options.inverse(this);
//         case '<':
//             return (v1 < v2) ? options.fn(this) : options.inverse(this);
//         case '<=':
//             return (v1 <= v2) ? options.fn(this) : options.inverse(this);
//         case '>':
//             return (v1 > v2) ? options.fn(this) : options.inverse(this);
//         case '>=':
//             return (v1 >= v2) ? options.fn(this) : options.inverse(this);
//         case '&&':
//             return (v1 && v2) ? options.fn(this) : options.inverse(this);
//         case '||':
//             return (v1 || v2) ? options.fn(this) : options.inverse(this);
//         default:
//             return options.inverse(this);
//     }
// });
