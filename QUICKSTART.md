# Quick Start Guide

## Get Started in 5 Minutes

### Step 1: Install Dependencies

From the project root:

```bash
cd /Users/tavram/Projects/ibkr-tracing
npm install
npm run install:all
```

### Step 2: Configure Backend

```bash
cd backend
cp .env.example .env
```

The default settings work for most setups with TWS.

### Step 3: Setup IBKR (Optional)

If you want IBKR integration:

1. Open TWS or IB Gateway
2. Go to **File → Global Configuration → API → Settings**
3. Enable **ActiveX and Socket Clients**
4. Note the Socket Port (usually **7497**)
5. Click **OK**

### Step 4: Start the Application

From the project root:

```bash
npm run dev
```

This will start both backend and frontend servers.

### Step 5: Open the App

Visit http://localhost:5173

## Without IBKR

You can use the app without IBKR integration:

1. Click "+" to create a manual tracker
2. Enter your investment details
3. Track your progress manually

## With IBKR

1. Connect to IBKR using the connection panel
2. Click "IBKR" button to import positions
3. Select a position to create a tracker
4. The app will sync with your current portfolio value

## Troubleshooting

**Cannot connect to IBKR?**
- Make sure TWS/IB Gateway is running
- Check that API is enabled in settings
- Verify port 7497 is being used

**Backend not starting?**
- Check if port 3001 is available
- Look for errors in the terminal

**Frontend errors?**
- Try clearing browser cache
- Check browser console for errors

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore the different tracking modes
- Customize your investment projections

Enjoy tracking your investments!
