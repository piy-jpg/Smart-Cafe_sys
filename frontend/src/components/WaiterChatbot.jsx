import React, { useState } from 'react';
import { Fab, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, List, ListItem, ListItemText, Chip, IconButton } from '@mui/material';
import { Chat, Close, Help } from '@mui/icons-material';

const WaiterChatbot = () => {
  const [open, setOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  const faqs = [
    {
      question: "How do I place a new order?",
      answer: "1. Select a table from the dropdown\n2. Add items to your cart by clicking the menu items\n3. Enter customer name and phone (optional)\n4. Click 'Place Order' to submit"
    },
    {
      question: "How do I add items to an existing order?",
      answer: "1. Find the order in your active orders list\n2. Click 'Add Items' on that order\n3. Add new items to the cart\n4. Click 'Add to Order' to submit the additional items"
    },
    {
      question: "What do the order statuses mean?",
      answer: "• Pending: Order received, waiting for kitchen\n• Preparing: Kitchen is making the order\n• Ready: Order is ready for pickup/delivery\n• Served: Order has been delivered to customer"
    },
    {
      question: "How do I mark an order as served?",
      answer: "When an order status shows as 'Ready', click the 'Mark Served' button to indicate it has been delivered to the customer."
    },
    {
      question: "How do I filter orders by table?",
      answer: "Use the 'Filter by Table' dropdown above the orders list to show orders for a specific table, or select 'All Tables' to see everything."
    },
    {
      question: "How does the cart work?",
      answer: "• Click menu items to add them to cart\n• Use + and - buttons to adjust quantities\n• Cart total updates automatically\n• Cart clears after placing order"
    },
    {
      question: "What is the difference between Table and Packing orders?",
      answer: "• Table orders: For dine-in customers at specific table numbers\n• Packing orders: For take-away or delivery orders"
    },
    {
      question: "How do I search for menu items?",
      answer: "Use the search bar above the menu to find items by name. You can also filter by category using the category buttons."
    },
    {
      question: "What happens when I add items to a ready order?",
      answer: "The order status will change back to 'Pending' and return to the kitchen queue for the next preparation batch."
    },
    {
      question: "How do I handle customer information?",
      answer: "Enter customer name and phone number when placing orders. This helps with order tracking and customer service."
    }
  ];

  const handleQuestionClick = (index) => {
    setSelectedQuestion(selectedQuestion === index ? null : index);
  };

  return (
    <>
      <Fab
        color="primary"
        size="large"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
          }
        }}
      >
        <Help />
      </Fab>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Chat color="primary" />
              <Typography variant="h6" component="div">
                Waiter Dashboard Help
              </Typography>
            </div>
            <IconButton onClick={() => setOpen(false)} size="small">
              <Close />
            </IconButton>
          </div>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Frequently asked questions about using the waiter dashboard
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <List>
            {faqs.map((faq, index) => (
              <ListItem
                key={index}
                button
                onClick={() => handleQuestionClick(index)}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                <ListItemText
                  primary={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Typography variant="subtitle2" component="span">
                        {faq.question}
                      </Typography>
                      <Chip
                        label={selectedQuestion === index ? 'Hide' : 'Show'}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    </div>
                  }
                  secondary={
                    selectedQuestion === index && (
                      <Typography
                        variant="body2"
                        color="text.primary"
                        sx={{
                          mt: 1,
                          p: 2,
                          backgroundColor: 'grey.50',
                          borderRadius: 1,
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {faq.answer}
                      </Typography>
                    )
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setOpen(false)} variant="outlined">
            Close Help
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WaiterChatbot;