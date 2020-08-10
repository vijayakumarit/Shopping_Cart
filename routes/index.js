var express = require('express');
var router = express.Router();
const bcrypt= require('bcryptjs');
const {Product}= require('../models/product');
const {User}= require('../models/user');
const {Order}= require('../models/order');
const Cart= require('../models/cart');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
var cookieParser = require('cookie-parser');

router.all('/*',(req,res,next)=> {
    req.app.locals.layout= 'layout';
    next();
})

const isLoggedout= (req,res,next)=> {
    if(! req.isAuthenticated()){  
        next();
    }else{
        req.flash('error_message',`You need to logout first.`);
        res.redirect('/');
    }
}

const isLoggedin= (req,res,next)=> {
    if(req.isAuthenticated()){
        
        User.findOne({email:req.user.email}).then((user)=> {
            req.session.cart= user.cart;
        })
//        console.log(req.session.cart);
        next();    
    }else{
        req.flash('error_message',`You need to login first.`);
        res.redirect('/');
    }
}

const isLoggedin_4_logout= (req,res,next)=> {
    if(req.isAuthenticated()){
        next();    
    }else{
//        req.flash('error_message',`You need to logout first.`);
        res.redirect('/');
    }
}


router.get('/signup',isLoggedout,(req,res,next)=> {
 
    res.render('routes_UI/signup');
})


router.get('/login',isLoggedout,(req,res,next)=> {
 
    res.render('routes_UI/login');
})


router.get('/profile',isLoggedin,(req,res,next)=> {
 
    Order.find({userEmail:req.user.email}).then((orders)=> {
        
        console.log(orders);
        res.render('routes_UI/profile',{user:req.user, orders:orders});
    })
})

router.get('/reduce/:id',(req,res)=> {
    
    let cart= new Cart(req.session.cart ? req.session.cart : {} );
    cart.reduceByOne(req.params.id);
    cart.generateArray();
    req.session.cart= cart;
    
    if(req.isAuthenticated()){ 
        User.findOne({email:req.user.email}).then((user)=> {
            user.cart= cart;  
            user.save();
            console.log(user.cart);
        })
    }
    console.log(req.session.cart);   
    res.redirect('/cart');    
})


router.get('/removeItem/:id',(req,res)=> {
    
    let cart= new Cart(req.session.cart ? req.session.cart : {} );
    cart.removeItem(req.params.id);
    cart.generateArray();
    req.session.cart= cart;
    
    if(req.isAuthenticated()){ 
        User.findOne({email:req.user.email}).then((user)=> {
            user.cart= cart;  
            user.save();
            console.log(user.cart);
        })
    } 
    console.log(req.session.cart);
    res.redirect('/cart');    
})

    

router.put('/add-to-cart/:id',(req,res,next)=> {

    let cart= new Cart(req.session.cart ? req.session.cart : {} );
    
    Product.findById(req.params.id).then((product)=> {
    
        cart.add(product, product.id);
        cart.generateArray();
        req.session.cart= cart;
        
        if(req.isAuthenticated()){
           User.findOne({email:req.user.email}).then((user)=> {
           user.cart=req.session.cart;
             user.save().then(()=>{
                  res.redirect('/'); 
             })
        })
        }else{
            res.redirect('/'); 
        }   
    }); 
});


router.get('/cart',(req,res)=> {
    
    let cart= req.session.cart || {};
    let itemsArray= cart.itemsArray ||[];
    
    res.render('routes_UI/cart',{cart, itemsArray, user:req.user});
})


router.get('/checkout',isLoggedin, (req,res)=> {
    let error_message= req.flash('error_message')[0];
    if(!req.session.cart){
        req.flash('error_message',`Add some items first.`);
        res.redirect('/cart');
    }else{
        res.render('routes_UI/checkout',{user:req.user, totalPrice:req.session.cart.totalPrice, error_message:error_message});
    }
})

router.post('/checkout',(req,res)=> {
    
    var stripe = require("stripe")("sk_test_JFyJNPEu7Ld6DOjnMxZU5CTY");

    stripe.charges.create({
      amount: req.session.cart.totalPrice * 100,
      currency: "usd",
      source: req.body.stripeToken, // obtained with Stripe.js
      description: "Charge for products."
    }, function(err, charge) {
      if(err){
          console.log(err);
          req.flash('error_message',err.message);
          return res.redirect('/checkout');
      }
        if(charge){
            
            console.log(charge);
            const newOrder= new Order({
                userEmail:req.user.email,
                order:req.user.cart,
                name:req.body.name,
                address:req.body.address,
                paymentId:charge.id,     
            })
            newOrder.save();
            
        
           User.findOne({email:req.user.email}).then((user)=> {
               
//              user.orders.push(user.cart);
//              console.log(user.orders[0]);
              req.session.cart= null;
              user.cart= null;
               
              user.save().then(()=> {
                  req.flash('success_message',`successfully bought product(s)!`);
                  res.redirect('/');
              })
           })
        }
    });
    
})
                           

router.get('/',(req, res)=> {
    

    let success_message= req.flash('success_message');

    Product.find().then((products)=> {
        
        let productChunks=[];
        const chunkSize= 4;
        for(let i=0; i<products.length; i +=chunkSize){
            productChunks.push(products.slice(i, i+chunkSize));
        }
        
        if(req.isAuthenticated()){     
            User.findOne({email:req.user.email}).then((user)=> {
                
                let x= JSON.stringify(req.session.cart);
                let y= JSON.stringify(user.cart);
                let z= (x !== y);
                
                console.log(user.cart);
                console.log(req.session.cart);
                if(req.session.cart && z){
                    
                    let cart= new Cart(user.cart ? user.cart : {} );
                
                    cart.add2(req.session.cart);
                    cart.generateArray();
                    req.session.cart= cart;
                    user.cart= cart;
                    
                    
                }else{
                    req.session.cart=user.cart;
                }   
                console.log(req.session.cart);
                user.save().then(()=> {
                    res.render('routes_UI/index', {productChunks, user:req.user,success_message});
                })     
            })          
        }
        
        else{
            res.render('routes_UI/index', {productChunks});
        }
        
    })
});


router.get('/logout',isLoggedin_4_logout,(req, res)=>{
 
    req.session.destroy();
    req.logout();
    res.redirect('/login');
    
});


router.post('/signup',(req,res)=> {
       
    if(req.body.password!==req.body.confirmPassword){
        req.flash('error_message',`Passwords do not match`);
        res.redirect('/signup');
    }else{
        
        User.findOne({ email: req.body.email}).then((user)=> {
            if(user){
               req.flash('error_message',`A user with this email already exists`);
               res.redirect('/signup');
            }else{
                    bcrypt.genSalt(10, function(err, salt) {
                    bcrypt.hash(req.body.password, salt, function(err, hash) {

                        const user= new User({
                                username:req.body.username,
                                email:req.body.email,
                                password:hash
                            });

                        user.save().then(()=> {
                            req.flash('success_message',`You have registered successfully, please login`);
                            res.redirect('/login');
                        });
                     });
                  });
            }
        })   
    }   
})


passport.use(new LocalStrategy({usernameField: 'email'},
  (email, password, done)=> {
    
    User.findOne({email:email}).then((user)=> {
        
      if (!user) {
        return done(null, false);
      }
        
        bcrypt.compare(password, user.password,(err, matched)=> {
            
                if(matched){
                    return done(null, user);
                }
                else{
                    return done(null, false);
                }
        });
    })
   }
));


passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});



router.post('/login',
  passport.authenticate('local'
                        , {successRedirect: '/',
                          failureRedirect: '/login',
                          failureFlash: 'Invalid email or password.',
                          successFlash: 'You are logged in, now you can buy products.'}
                       ));



const products= [
    new Product({
        imagePath: 'https://rukminim1.flixcart.com/image/658/790/kd3f3bk0/jean/1/c/j/40-kjb-1438-dnft-bl-killer-original-imafu3y6ypzvj7n6.jpeg?q=50',
        title: 'Regular Men Dark Blue Jeans',
        description: 'Product Details : #Comfort stretch denim with unique metal branding and personalized details, power flex stretch. #Slim Fit, #Featuring 5 pocket design, Zip Fly & Shank Button fastening at the Top, #Zip Fly & Shank Button fastening at the Top',
        price: 400
    }),
    new Product({
        imagePath: 'https://rukminim1.flixcart.com/image/416/416/jteoosw0/battery-charger/v/y/g/ubon-ch-584-2-4a-mobile-chager-cum-power-socket-original-imafeqjg8vf6ecwy.jpeg?q=70',
        title: '2.4A Mobile Chager Cum Power socket',
        description: 'Product Details : #Sales Package : 1 Ubon Mobile Charger Or Wall Charger, #Series : Fast chager, #Model Number : CH-584 2.4A Mobile Chager Cum Power socket',
        price: 150
    }),
    
    new Product({
        imagePath: 'https://rukminim1.flixcart.com/image/880/1056/k47cgi80/watch/3/f/b/new-stylish-boys-combo-rizzly-original-imafn5y4wbnkjzqa.jpeg?q=50',
        title: 'Rizzly New Stylish Boys Combo Analog Watch',
        description: 'Description : #Display Type : Analog, #Style Code : New Stylish Boys Combo, #Occasion : Casual, #Watch Type : Wrist Watch, #Pack of : 6, #Dial Color : Multicolor',
        price: 569
    }),
    new Product({
        imagePath: 'https://rukminim1.flixcart.com/image/416/416/k02qnww0/monitor/s/z/c/22mp68vq-22mp68-lg-original-imafjy9zfwfnngna.jpeg?q=70',
        title: 'LG 22 inch Full HD LED Backlit IPS Panel Monitor',
        description: 'Product Details : #Model Name : 22MP68VQ, #Color : Black, #Display : 55.88 cm (22 inch) LED Backlit Display, #Backlight : LED Backlit Backlight',
        price: 20000
    }),
    new Product({
        imagePath: 'https://rukminim1.flixcart.com/image/880/1056/k0h12fk0/shoe/g/3/m/hfi12-9-adidas-cblack-silvmt-cblack-original-imafk94hvbev6zg6.jpeg?q=50',
        title: 'Kyris 4.0 Ms Running Shoes For Men  (Black, Grey)',
        description: 'Product Details : #Color : Black, Grey, #Outer Material : Fabric, #Model Name : Kyris 4.0 Ms, #Ideal For : Men, #Occasion : Sports, #Leather Type : Napa, #Secondary Color : Black',
        price: 1669
    }),
    new Product({
         imagePath:
        'https://rukminim1.flixcart.com/image/416/416/k3xcdjk0pkrrdj/indoor-furniture/r/x/g/xxxl-brwn01-goga-goga01-original-imafjegca4hkhvba.jpeg?q=70',
        title: 'VSK XXL Tear Drop Bean Bag Cover',
        description: 'Description : Lounge around in the comfort of vsk bean bags. The classic style is the evergreen bean bag style with an indulging comfort. With a soft leatherette fabric and premium stitching.',
        price: 594
    }),
    new Product({
        imagePath:
       'https://rukminim1.flixcart.com/image/416/416/kbpeoi80/painting/h/m/e/phsx30182-flipkart-perfect-homes-original-imafszw7zn6ndauc.jpeg?q=70',
       title: 'Perfect Homes Large Panel Embossed Painting',
       description: 'Specifications : #Model Number : PHSX30182, #Outer Material : Fabric, #Model Name : Large Panel, #Frame Included : No, #Wall Mount : Yes, #Pack of : 3, #Sales Package : 3 Large Panels, #Frame Material : Wood, #Shape : Rectangular',
       price: 379
   }),
   new Product({
    imagePath:
   'https://rukminim1.flixcart.com/image/416/416/jx257680/office-study-chair/s/t/s/pp-polypropylene-carex-da-urban-original-imafgc3y5mzythgx.jpeg?q=70',
   title: 'Da URBAN Carex Medium Back Fabric Office Executive Chair',
   description: 'Highlights : #Wheels, Seat Lock, Swivel, Locking Mechanism, Armrest, Adjustable Seat Height, #W x H: 86 cm x 36 cm (2 ft 9 in x 1 ft 2 in), #Frame Material: Metal, #Upholstery Type: Mesh',
   price: 4350
})
]

for(let i=0; i < products.length; i++){
    
    Product.find().then((productss)=> {
        let count= 0;
        for(let j=0; j< productss.length; j++){
            if(products[i].title===productss[j].title){
               count++;
            }
        }
        if(count==0){
            products[i].save();
        }
    })
    
}


module.exports = router;
