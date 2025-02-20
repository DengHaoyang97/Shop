const dotenv = require('dotenv');
dotenv.config();

const path = require("path");

const helmet = require('helmet');
const multer  = require('multer');

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
let session = require('express-session');
const csrf = require('csurf')
const flash = require('connect-flash');
const compression = require('compression');
const morgan = require('morgan')
const MongoDBStore = require('connect-mongodb-session')(session);

const cloudinary = require("./cloudinaryConfig");
const cloudinaryStorage = require("multer-storage-cloudinary");

const User = require('./models/user');
const errorController = require("./controllers/error");

// ✅ 读取环境变量，提供默认值（防止 `undefined`）
const MONGO_DB_URI = process.env.MONGO_DB_URI || "mongodb+srv://admin:110120119@cluster0.fah8o.mongodb.net/myDatabase?retryWrites=true&w=majority&appName=Cluster0";
const PORT = process.env.PORT || 3000;

if (!MONGO_DB_URI) {
  console.error("❌ MONGO_DB_URI is not defined! Check your environment variables.");
  process.exit(1); // 直接终止程序，避免错误连接
}

const app = express();

app.use(helmet())
app.use(compression())
app.use(morgan('combined'))

app.set("view engine", "ejs");
app.set("views", "views");

const csrfProtection = csrf();

const storage = cloudinaryStorage({
	cloudinary
});

const fileFilter = (req, file, cb) => {
  if(file.mimetype === 'image/png' || file.mimetype === 'image/jpg'|| file.mimetype === 'image/jpeg'){
    cb(null, true);
  }
  else {
    cb(null, false);
  }
}

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({ storage: storage, fileFilter }).single('image'));

app.use(express.static(path.join(__dirname, "public")));
app.use('/images', express.static(path.join(__dirname, "images")));

app.use(session({
  secret: 'randomstring',
  resave: false,
  saveUninitialized: false,
  store: new MongoDBStore({ uri: MONGO_DB_URI, collection: 'sessions' })
}));

app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then(user => {
      if(!user){
        return next()
      }
      req.user = user;
      next();
    })
    .catch(err => {
      next(new Error(err));
    });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use('/500', errorController.get500);
app.use(errorController.get404);

app.use((error, req, res, next) => {
  res
    .status(500)
    .render("500", {
      pageTitle: "Something went wrong",
      path: "/500",
      isAuthenticated: req.session.isLoggedIn
    });
})

// ✅ `mongoose.connect()` 之前检查 MONGO_DB_URI
mongoose.connect(MONGO_DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => {
    console.log(`✅ Connected to MongoDB: ${MONGO_DB_URI}`);
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
});
