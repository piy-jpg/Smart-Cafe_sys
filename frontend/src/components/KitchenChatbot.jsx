import React, { useState } from 'react';
import { Fab, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, List, ListItem, ListItemText, Chip, IconButton } from '@mui/material';
import { Help, Close, Restaurant } from '@mui/icons-material';

const KitchenChatbot = () => {
  const [open, setOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  const faqs = [
    {
      question: "What do the order status colors mean?",
      answer: "• Red: Pending orders waiting to start\n• Blue: Preparing - currently being made\n• Green: Ready for pickup/delivery\n• Gray: Served - order completed"
    },
    {
      question: "How do I update order status?",
      answer: "Click the status buttons on each order card:\n• 'Start Preparing' for pending orders\n• 'Mark Ready' when food is complete\n• Orders automatically move to 'Served' when picked up by waiters"
    },
    {
      question: "What do the urgency indicators mean?",
      answer: "• Green: On time (under 10 minutes)\n• Yellow: Watch (10-19 minutes) - needs attention\n• Red: Critical (20+ minutes) - urgent priority\n• Gray: Unknown age"
    },
    {
      question: "How does the sound alert system work?",
      answer: "• Bell sound plays for new orders and item additions\n• Click the speaker icon to mute/unmute alerts\n• Alerts help you notice new work immediately"
    },
    {
      question: "How do I filter and search orders?",
      answer: "• Status filter: Show only pending, preparing, or ready orders\n• Table filter: Focus on specific table orders\n• Search: Find by order ID, table number, or item names\n• Sort by oldest/newest to prioritize work"
    },
    {
      question: "What is the 'Items in Queue' metric?",
      answer: "Shows total individual items across all active orders. Helps you understand preparation workload - a high number means lots of cooking to do."
    },
    {
      question: "How do I handle order modifications?",
      answer: "When waiters add items to existing orders:\n• Order returns to pending status\n• New items appear in the order details\n• You'll hear an alert sound\n• Order gets highlighted temporarily"
    },
    {
      question: "What should I do with ready orders?",
      answer: "• Keep ready orders visible for waiters to pick up\n• Use the green 'Ready' status filter to see all completed orders\n• Waiters will mark orders as 'Served' when delivered"
    },
    {
      question: "How do I print kitchen bills?",
      answer: "Click the 'Print Kitchen Bill' button on any order to get a paper copy with all items, quantities, and preparation notes for the kitchen staff."
    },
    {
      question: "How do I check menu availability?",
      answer: "Menu availability is shown in the Menu Catalog panel. Items with zero stock or marked unavailable will be grayed out or hidden depending on the view. Always check stock levels before starting preparations."
    },
    {
      question: "How do I view the current menu?",
      answer: "The Menu Catalog panel displays all current menu items with prices, categories, and availability. You can search by name or filter by category to find specific items quickly."
    },
    {
      question: "What happens when menu items run out of stock?",
      answer: "When stock reaches zero, items become unavailable automatically. The system prevents new orders from including out-of-stock items. Notify managers if you need restocking."
    },
    {
      question: "How do I handle special menu requests?",
      answer: "For custom or special menu requests, check with waiters for details. Some items may have preparation notes in the order. If unavailable, inform the waiter immediately."
    },
    {
      question: "How do I access previous menu data history?",
      answer: "Previous menu data is automatically backed up in the backend/backups folder with timestamps. Contact the system administrator or owner to restore menu data from previous backups if needed."
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
          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #e55a2b 0%, #e8851a 100%)',
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
              <Restaurant color="primary" />
              <Typography variant="h6" component="div">
                Kitchen Dashboard Help
              </Typography>
            </div>
            <IconButton onClick={() => setOpen(false)} size="small">
              <Close />
            </IconButton>
          </div>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Frequently asked questions about kitchen operations
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

export default KitchenChatbot;