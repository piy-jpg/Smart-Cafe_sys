const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { appendAuthActivity } = require('../utils/ownerControlStore');

const recordAuthEvent = (req, payload) => {
  appendAuthActivity({
    ...payload,
    ip_address: req.ip,
    user_agent: req.get('user-agent') || 'Unknown'
  });

  if (req.io) {
    req.io.emit('systemControlUpdated');
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // For demo purposes when DB is down, provide a hardcoded bypass!
    if (email === 'demo@waiter.com' && password === 'demo') {
      const token = jwt.sign({ id: 1, role: 'waiter' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      recordAuthEvent(req, { email, outcome: 'success', event_type: 'login', role: 'waiter', user_name: 'Demo Waiter' });
      return res.json({ success: true, token, user: { id: 1, name: 'Demo Waiter', role: 'waiter' } });
    }
    if (email === 'demo@chef.com' && password === 'demo') {
      const token = jwt.sign({ id: 2, role: 'chef' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      recordAuthEvent(req, { email, outcome: 'success', event_type: 'login', role: 'chef', user_name: 'Demo Chef' });
      return res.json({ success: true, token, user: { id: 2, name: 'Demo Chef', role: 'chef' } });
    }
    if (email === 'demo@manager.com' && password === 'demo') {
      const token = jwt.sign({ id: 3, role: 'manager' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      recordAuthEvent(req, { email, outcome: 'success', event_type: 'login', role: 'manager', user_name: 'Demo Manager' });
      return res.json({ success: true, token, user: { id: 3, name: 'Demo Manager', role: 'manager' } });
    }
    if (email === 'demo@owner.com' && password === 'demo') {
      const token = jwt.sign({ id: 4, role: 'owner' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      recordAuthEvent(req, { email, outcome: 'success', event_type: 'login', role: 'owner', user_name: 'Demo Owner' });
      return res.json({ success: true, token, user: { id: 4, name: 'Demo Owner', role: 'owner' } });
    }

    // Standard database lookup
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      recordAuthEvent(req, { email, outcome: 'failed', event_type: 'login', reason: 'user_not_found' });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // In a highly secure app, use bcrypt.compare here
    if (user.password !== password) {
      recordAuthEvent(req, { email, outcome: 'failed', event_type: 'login', role: user.role, user_name: user.name, reason: 'invalid_password' });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    recordAuthEvent(req, { email, outcome: 'success', event_type: 'login', role: user.role, user_name: user.name });
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);
    recordAuthEvent(req, { email: req.body?.email, outcome: 'failed', event_type: 'login', reason: 'server_error' });
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const newUser = await User.create({
      name,
      email,
      password, // In a real system, hash using bcrypt before storing
      role: role || 'waiter'
    });

    const token = jwt.sign({ id: newUser.id, role: newUser.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    recordAuthEvent(req, { email, outcome: 'success', event_type: 'register', role: newUser.role, user_name: newUser.name });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error(error);
    recordAuthEvent(req, { email: req.body?.email, outcome: 'failed', event_type: 'register', reason: 'server_error' });
    res.status(500).json({ success: false, message: 'Database disconnected. Please update your .env root password to create real accounts!' });
  }
};
