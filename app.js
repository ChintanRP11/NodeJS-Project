const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');

const errorController = require('./controllers/error');
const sequelize = require('./util/database');

const Product = require('./models/product');
const User = require('./models/user');
const Cart = require('./models/cart');
const CartItem = require('./models/cart-item');

const app = express();

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    User.findByPk(1)
        .then(user => {
            req.user = user;
            next();
        })
        .catch(err => console.log(err));;
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);

app.use(errorController.get404);

// associations
Product.belongsTo(User, {constraints: true, onDelete: 'CASCADE'});
User.hasMany(Product);
User.hasOne(Cart);
Cart.belongsToMany(Product, { through: CartItem });
Product.belongsToMany(Cart, { through: CartItem });

// sync all models to SQL database: create tables according to models if not exists
sequelize
    .sync()
    // .sync({force: true})
    .then(result => {
        return User.findByPk(1);
    }).then(user => {
        if (!user) {
            return User.create({name: 'Chintan', email: 'test@test.com'})
            .then(user => {
                return user.createCart();
            }).catch(err => console.log(err));
        }
        return user;
    }).then(cart => {
        // console.log(user);
        app.listen(3000);
    }).catch(err => console.log(err));




