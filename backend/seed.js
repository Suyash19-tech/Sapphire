const mongoose = require('mongoose');
const dotenv = require('dotenv');
const MenuItem = require('./models/MenuItem');

dotenv.config();

const menuData = [ 
  { "name": "Samosa", "category": "Quick Snacks", "price": 15, "isAvailable": true }, 
  { "name": "Aloo Bada", "category": "Quick Snacks", "price": 15, "isAvailable": true }, 
  { "name": "Poha", "category": "Quick Snacks", "price": 25, "isAvailable": true }, 
  { "name": "Vada Pav", "category": "Quick Snacks", "price": 25, "isAvailable": true }, 
  { "name": "Omelette", "category": "Quick Snacks", "price": 40, "isAvailable": true }, 
  { "name": "Aloo Patties", "category": "Quick Snacks", "price": 20, "isAvailable": true }, 
  { "name": "Paneer Patties", "category": "Quick Snacks", "price": 30, "isAvailable": true }, 

  { "name": "Veg Sandwich", "category": "Sandwich", "price": 25, "isAvailable": true }, 
  { "name": "Cheese Sandwich", "category": "Sandwich", "price": 45, "isAvailable": true }, 
  { "name": "Grilled Sandwich", "category": "Sandwich", "price": 60, "isAvailable": true }, 
  { "name": "Cheese Grilled Sandwich", "category": "Sandwich", "price": 70, "isAvailable": true }, 
  { "name": "Corn Cheese Grilled Sandwich", "category": "Sandwich", "price": 85, "isAvailable": true }, 

  { "name": "Cheese Burger", "category": "Pizza & Burger", "price": 60, "isAvailable": true }, 
  { "name": "Mini Pizza", "category": "Pizza & Burger", "price": 55, "isAvailable": true }, 

  { "name": "Veg Chowmein", "category": "Chinese", "price": 55, "isAvailable": true }, 
  { "name": "Chilly Potato", "category": "Chinese", "price": 60, "isAvailable": true }, 
  { "name": "Veg Manchurian", "category": "Chinese", "price": 60, "isAvailable": true }, 
  { "name": "Fried Rice", "category": "Chinese", "price": 55, "isAvailable": true }, 

  { "name": "Chole Bhature", "category": "North Indian", "price": 70, "isAvailable": true }, 
  { "name": "Chole Chawal", "category": "North Indian", "price": 60, "isAvailable": true }, 
  { "name": "Chole Kulche", "category": "North Indian", "price": 60, "isAvailable": true }, 
  { "name": "Chole Puri", "category": "North Indian", "price": 45, "isAvailable": true }, 
  { "name": "Pav Bhaji", "category": "North Indian", "price": 70, "isAvailable": true }, 
  { "name": "Rajma Chawal", "category": "North Indian", "price": 60, "isAvailable": true }, 

  { "name": "Masala Dosa", "category": "South Indian", "price": 70, "isAvailable": true }, 
  { "name": "Paneer Dosa", "category": "South Indian", "price": 90, "isAvailable": true }, 
  { "name": "Uttapam", "category": "South Indian", "price": 75, "isAvailable": true }, 

  { "name": "Aloo Paratha", "category": "Paratha", "price": 30, "isAvailable": true }, 
  { "name": "Paneer Paratha", "category": "Paratha", "price": 60, "isAvailable": true }, 
  { "name": "Mix Paratha", "category": "Paratha", "price": 45, "isAvailable": true }, 
  { "name": "Gobhi Paratha", "category": "Paratha", "price": 35, "isAvailable": true }, 
  { "name": "Onion Paratha", "category": "Paratha", "price": 30, "isAvailable": true }, 

  { "name": "White Sauce Pasta", "category": "Pasta", "price": 80, "isAvailable": true }, 
  { "name": "Red Sauce Pasta", "category": "Pasta", "price": 70, "isAvailable": true }, 

  { "name": "Veg Maggi", "category": "Maggi", "price": 40, "isAvailable": true }, 
  { "name": "Masala Maggi", "category": "Maggi", "price": 35, "isAvailable": true }, 
  { "name": "Cheese Masala Maggi", "category": "Maggi", "price": 55, "isAvailable": true }, 
  { "name": "Egg Maggi", "category": "Maggi", "price": 50, "isAvailable": true }, 

  { "name": "Coffee", "category": "Hot Beverage", "price": 20, "isAvailable": true }, 
  { "name": "Coffee Special", "category": "Hot Beverage", "price": 35, "isAvailable": true }, 
  { "name": "Tea", "category": "Hot Beverage", "price": 15, "isAvailable": true }, 
  { "name": "Tea Special", "category": "Hot Beverage", "price": 20, "isAvailable": true }, 

  { "name": "Cold Coffee", "category": "Cold Beverage", "price": 60, "isAvailable": true }, 
  { "name": "Iced Cold Coffee", "category": "Cold Beverage", "price": 65, "isAvailable": true }, 
  { "name": "Iced Tea", "category": "Cold Beverage", "price": 50, "isAvailable": true }, 
  { "name": "Lassi", "category": "Cold Beverage", "price": 40, "isAvailable": true }, 
  { "name": "Butter Milk", "category": "Cold Beverage", "price": 20, "isAvailable": true } 
];

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing items
        await MenuItem.deleteMany({});
        console.log('Cleared existing MenuItem collection.');

        // Insert new data
        await MenuItem.insertMany(menuData);
        console.log(`Successfully seeded ${menuData.length} menu items.`);

        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
