const express = require('express');
const db = require('../db/models');
const { csrfProtection, asyncHandler } = require('./utils');
const { check, validationResult } = require('express-validator');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { loginUser, logoutUser } = require('../auth');

router.get('/register', csrfProtection, asyncHandler(async(req, res) => {
    const user = db.User.build();
    res.render('user-register', {
        title: 'Register',
        user,
        csrfToken: req.csrfToken()
    })
}));

//Common 'db is not defined' bug
const userValidators = [
    check('firstName')
      .exists({ checkFalsy: true })
      .withMessage('Please provide a value for First Name')
      .isLength({ max: 50 })
      .withMessage('First Name must not be more than 50 characters long'),
    check('lastName')
      .exists({ checkFalsy: true })
      .withMessage('Please provide a value for Last Name')
      .isLength({ max: 50 })
      .withMessage('Last Name must not be more than 50 characters long'),
    check('emailAddress')
      .exists({ checkFalsy: true })
      .withMessage('Please provide a value for Email Address')
      .isLength({ max: 255 })
      .withMessage('Email Address must not be more than 255 characters long')
      .isEmail()
      .withMessage('Email Address is not a valid email')
      .custom((value) => {
        return db.User.findOne({ where: { emailAddress: value } })
          .then((user) => {
            if (user) {
              return Promise.reject('The provided Email Address is already in use by another account');
            }
          });
      }),
    check('password')
      .exists({ checkFalsy: true })
      .withMessage('Please provide a value for Password')
      .isLength({ max: 50 })
      .withMessage('Password must not be more than 50 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, 'g')
      .withMessage('Password must contain at least 1 lowercase letter, uppercase letter, number, and special character (i.e. "!@#$%^&*")'),
    check('confirmPassword')
      .exists({ checkFalsy: true })
      .withMessage('Please provide a value for Confirm Password')
      .isLength({ max: 50 })
      .withMessage('Confirm Password must not be more than 50 characters long')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Confirm Password does not match Password');
        }
        return true;
      }),
  ];

router.post('/register', csrfProtection, userValidators,
asyncHandler(async (req, res) => {
  const {
    emailAddress,
    firstName,
    lastName,
    password,
  } = req.body;
  const user = db.User.build({
    emailAddress,
    firstName,
    lastName,
  });
  console.log('DESTRUCTURED')
  const validatorErrors = validationResult(req);
  if (validatorErrors.isEmpty()) {
    console.log('SUCCESS')
    const hashedPassword = await bcrypt.hash(password, 10);
    user.hashedPassword = hashedPassword;
    await user.save();
    loginUser(req, res, user);
    req.session.save(() => res.redirect('/'));
  } else {
    console.log('FAILURE')
    const errors = validatorErrors.array().map((error) => error.msg);
    res.render('user-register', {
      title: 'Register',
      user,
      errors,
      csrfToken: req.csrfToken(),
    });
  }
}));

const loginValidators = [
  check('emailAddress')
    .exists({ checkFalsy: true })
    .withMessage('Please provide a value for Email Address'),
  check('password')
    .exists({ checkFalsy: true })
    .withMessage('Please provide a value for Password'),
];

router.get('/login', csrfProtection, asyncHandler(async(req, res) => {
  res.render('user-login', {
    title: 'Login',
    csrfToken: req.csrfToken(),
  });
}));

router.post('/login', csrfProtection, loginValidators,
  asyncHandler(async (req, res) => {
    const {
      emailAddress,
      password,
    } = req.body;

    let errors = [];
    const validatorErrors = validationResult(req);

    if (validatorErrors.isEmpty()) {
      const user = await db.User.findOne({ where: { emailAddress } });

      if (user !== null) {
        const passwordMatch = await bcrypt.compare(password, user.hashedPassword.toString());

        if (passwordMatch) {
          loginUser(req, res, user);
          return res.redirect('/');
        }
      }

      errors.push('Login failed for the provided email address and password');
    } else {
      errors = validatorErrors.array().map((error) => error.msg);
    }

    res.render('user-login', {
      title: 'Login',
      emailAddress,
      errors,
      csrfToken: req.csrfToken(),
    });
  }));

  router.post('/logout', (req, res) => {
    logoutUser(req, res);
    res.redirect('/');
  });

module.exports = router;