const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');

const Product = require('../models/product');
const Order = require('../models/order');
// const stripe = require('stripe')(process.env.STRIPE_KEY);

const ITEMS_PER_PAGE = 3;


exports.getProducts = (req, res, next) => {
    const page = +req.query.page || 1;
    let totalItems;
    Product.find().count().then(numProducts => {
        totalItems = numProducts;
         return Product.find()
         .skip((page - 1) * ITEMS_PER_PAGE)
         .limit(ITEMS_PER_PAGE)
    }).then(products => {
            res.render('shop/product-list', {
                prods: products,
                pageTitle: 'All Products',
                path: '/products',
                currentPage: page,
                hasNextPage: ITEMS_PER_PAGE * page < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page+1,
                previousPage: page-1,
                lastPage: Math.ceil(totalItems/ITEMS_PER_PAGE)
            });
        }).catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getProduct = (req, res, next) => {
    const prodId = req.params.productId;
    // Product.findOne({ where: { id: prodId } })
    Product.findById(prodId)
        .then(product => {
            res.render('shop/product-detail', {
                product: product,
                pageTitle: product.title,
                path: '/products'
            });
        }).catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getIndex = (req, res, next) => {
    const page = +req.query.page || 1;
    let totalItems;
    Product.find().count().then(numProducts => {
        totalItems = numProducts;
         return Product.find()
         .skip((page - 1) * ITEMS_PER_PAGE)
         .limit(ITEMS_PER_PAGE)
    }).then(products => {
            res.render('shop/index', {
                prods: products,
                pageTitle: 'Shop',
                path: '/',
                currentPage: page,
                hasNextPage: ITEMS_PER_PAGE * page < totalItems,
                hasPreviousPage: page > 1,
                nextPage: page+1,
                previousPage: page-1,
                lastPage: Math.ceil(totalItems/ITEMS_PER_PAGE)
            });
        }).catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getCart = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .then(user => {
            const cartProducts = user.cart.items
            res.render('shop/cart', {
                products: cartProducts,
                pageTitle: 'Your Cart',
                path: '/cart'
            });
        }).catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postCart = (req, res, next) => {
    const prodId = req.body.productId;
    Product.findById(prodId)
        .then(product => {
            return req.user.addToCart(product);
        })
        .then(result => {
            res.redirect('/');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postCartDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId;
    req.user.deleteFromCart(prodId)
        .then(result => {
            res.redirect('/cart');
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getCheckout = (req, res, next) => {
    req.user
        .populate('cart.items.productId')
        .then(user => {
            const products = user.cart.items
            let total = 0;
            products.forEach(p => {
                total += p.quantity * p.productId.price;
            });
            res.render('shop/checkout', {
                products: products,
                pageTitle: 'Checkout',
                path: '/checkout',
                totalSum: parseFloat(total.toFixed(2))
            });
        }).catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postOrder= (req, res, next) => {
    // Token is created using Checkout or Elements!
    // Get the payment token ID submitted by the form:
    // const token = req.body.stripeToken; // Using Express
    let totalSum = 0;
    req.user
        .populate('cart.items.productId')
        .then(user => {
            user.cart.items.forEach(p => {
                totalSum += p.quantity * p.productId.price;
            });
            
            const products = user.cart.items.map(i => {
                return {quantity: i.quantity, product: { ...i.productId._doc } }
            });
            const order = new Order({
                user: {
                    email: req.user.email,
                    userId: req.user
                },
                products: products
            });
            return order.save();
        })
        .then(result => {
            // const charge = stripe.charges.create({
            //     amount: totalSum * 100,
            //     currency: 'usd',
            //     description: 'Demo Order',
            //     source: token,
            //     metadata: {order_id: result._id.toString()}
            // });
            return req.user.clearCart();
        })
        .then(result => {
            res.redirect('/orders');
            
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
    
        
};

exports.getOrders = (req, res, next) => {
    Order.find({ 'user.userId': req.user._id })
      .then(orders => {
        res.render('shop/orders', {
          path: '/orders',
          pageTitle: 'Your Orders',
          orders: orders
        });
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  };

exports.getInvoice = (req, res, next) => {
    const orderId = req.params.orderId;
    
    Order.findById(orderId)
        .then(order => {
            if (!order) {
                return next(new Error('No order found.'));
            }
            if (order.user.userId.toString() !== req.user._id.toString()) {
                return next(new Error("Unauthorized"));
            }
            const invoiceName = "invoice-"+orderId+".pdf";
            const invoicePath = path.join('data', 'invoices', invoiceName);

            const pdfDoc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="'+invoiceName+'"');
            
            pdfDoc.pipe(fs.createWriteStream(invoicePath));
            
            pdfDoc.pipe(res);
            pdfDoc.fontSize(26).text('Invoice', {
                underline: true
            });
            pdfDoc.fontSize(26).text('------------------------------------------------------');
            pdfDoc.fontSize(20).text('OrderId: #'+orderId);
            pdfDoc.fontSize(20).text('--------------');
            pdfDoc.fontSize(14).text('Order Details');
            pdfDoc.fontSize(18).text('------------------------------------------------------------------------------');
            
            let totalPrice = 0;

            order.products.forEach(prod => {
                let itemPrice = parseFloat(prod.quantity*prod.product.price).toFixed(2);
                totalPrice = totalPrice + prod.quantity*prod.product.price;
                pdfDoc.fontSize(14).text('Item: '+prod.product.title)
                pdfDoc.fontSize(14).text('Qty: ' + prod.quantity) 
                pdfDoc.fontSize(14).text('Unit price: ' + '$' + prod.product.price);
                pdfDoc.fontSize(14).text('Item total: $'+itemPrice, {align: 'right'});
                pdfDoc.fontSize(18).text('------------------------------------------------------------------------------');
            });
            totalPrice = parseFloat(totalPrice.toFixed(2))
            pdfDoc.fontSize(18).text('Total Amount: $' + totalPrice, {align: 'right'});
            pdfDoc.end();
            
            // fs.readFile(invoicePath, (err, data) => {
            //     if (err) {
            //         next(err);
            //     }
            //     res.setHeader('Content-Type', 'application/pdf');
            //     res.setHeader('Content-Disposition', 'attachment; filename="'+invoiceName+'"');
            //     res.send(data);
            // });
            // const file = fs.createReadStream(invoicePath);
            // res.setHeader('Content-Type', 'application/pdf');
            // res.setHeader('Content-Disposition', 'attachment; filename="'+invoiceName+'"');
            // file.pipe(res);
        })
        .catch(err => {console.log(err); next(err)});
}
