const express = require('express');
const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname, 'public'))); 

const mongoose = require('mongoose');

const morgan = require('morgan');

const bodyParser = require('body-parser');
const expressLayout = require('express-ejs-layouts');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const bcrypt = require('bcryptjs');

//socket.io
//this is the syntax to use socket.io with express
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));
const User = require('./api/models/usersmodel');

//passport config
require('./api/config/passport')(passport);

//EJS
app.use(expressLayout);
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
//app.use(methodOverride('_method'));

//Express session:
app.use(
    require('express-session')({
        secret: 'Cats is not a good movie',
        resave: false,
        saveUninitialized: false,
    })
);

//passport:
//passport-middleware
app.use(passport.initialize());
app.use(passport.session());

//connect-flash
app.use(flash());

//global vars
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

//middlewear to create dynamic login
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash('Error');
    res.locals.success = req.flash('Success');
    next();
});

//path for route files - Make sure these are requiring router objects
const galleryRoute = require('./api/routes/gallery');
const homeRoute = require('./api/routes/home');
const auctionRoute = require('./api/routes/auction');
const loginRoute = require('./api/routes/users');

//connecting DB
mongoose.connect('mongodb://localhost:27017/mini', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('connected to DB');
})
.catch((err) => {
    console.log(err);
});

//routes
app.use('/gallery', galleryRoute);
app.use('/', homeRoute);
app.use('/auction', auctionRoute);
app.use('/users', loginRoute);

//if no route is found
app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
});

//to handle all errors.
app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message,
        },
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server Running');
});

//socket configuration
// Make sure this appears after creating the server but before defining routes

// Setup socket.io
io.on('connection', (socket) => {
    console.log('User connected to socket', socket.id);

    // Listen for new bids
    socket.on('addData', (data) => {
        // Broadcast to all connected clients
        io.emit('addData', data);
    });

    // Listen for bid amount updates
    socket.on('newAmt', (amt) => {
        // Broadcast to all connected clients
        io.emit('newAmt', amt);
    });

    // Listen for disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected from socket', socket.id);
    });
});

// Make socket.io instance available to routes
app.set('io', io);