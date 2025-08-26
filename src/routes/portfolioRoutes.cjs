// src/routes/portfolioRoutes.cjs
const express    = require('express');
const Portfolio  = require('../models/portfolio.cjs');
const { authenticate } = require('../middleware/auth.cjs');

const router = express.Router();

// Create new portfolio
router.post('/', async (req, res) => {
  console.log('POST /api/portfolios body:', req.body);
  console.log('Authenticated user:', req.user.id);
  try {
    // Check if portfolio with same name already exists for this user
    const existingPortfolio = await Portfolio.findOne({ 
      user: req.user.id, 
      name: req.body.name 
    });
    
    if (existingPortfolio) {
      console.log('❌ Portfolio with this name already exists:', req.body.name);
      return res.status(400).json({ 
        message: 'A portfolio with this name already exists' 
      });
    }
    
    const p = await Portfolio.create({
      user: req.user.id,
      name: req.body.name,
      scripts: req.body.scripts
    });
    console.log('✅ Portfolio saved:', p._id);
    res.status(201).json(p);
  } catch (err) {
    console.error('❌ Portfolio save error:', err);
    res.status(500).json({ message: 'Portfolio save error' });
  }
});
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // yalnız öz user-in portfolios-unu silək
    const deleted = await Portfolio.findOneAndDelete({ _id: id, user: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: 'Portfolio tapılmadı və ya icazəniz yoxdur' });
    }
    res.json({ message: 'Portfolio uğurla silindi' });
  } catch (err) {
    console.error('Delete portfolio error:', err);
    res.status(500).json({ message: 'Server xətası' });
  }
});
// Get portfolios for current user
router.get('/', async (req, res) => {
  console.log('GET /api/portfolios for user:', req.user.id);
  try {
    const list = await Portfolio.find({ user: req.user.id }).sort('-createdAt');
    console.log('✅ Found portfolios count:', list.length);
    res.json(list);
  } catch (err) {
    console.error('❌ Fetch portfolios error:', err);
    res.status(500).json({ message: 'Fetch portfolios error' });
  }
});

module.exports = router;
