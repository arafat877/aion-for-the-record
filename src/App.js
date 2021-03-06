import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles, Typography } from '@material-ui/core';
import Web3 from 'aion-web3';

import './App.css';
import RecordInput from './RecordInput';
import RecordList from './RecordList';

const styles = theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh'
  },
  flex: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
    padding: 8,
  },
});

/**
 * This is the main component of the For The Record app.  It lays out
 * the other components of the app, and is responsible for all interaction with the Aion Network.
 * 
 * Normally, you might use a state management library such as Redux to handle your app's data.
 * To keep it simple, we just store the app data as state in the base App component.
 * 
 * This component has the functionality to submit a message to the app backend - where
 * it will be submitted as a transaction to the Aion network.  It also reads directly from
 * the smart contract event log in order to build up the app state..
 */
class App extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      messages: {},
      loadingMessages: false,
      submittingMessage: false,
    };
  }

  /**
   * Sends a message to the backend, where it will be submitted to the Aion network.
   */
  submitMessage = async (message) => {
    this.setState({ submittingMessage: true });

    const rawResponse = await fetch(`/submitRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/html'
      },
      body: JSON.stringify({ message: message })
    });
    
    const content = await rawResponse.json();
    if (content.status === 'success') {
      const messages = Object.assign({}, this.state.messages);
      messages[content.hash] = {
        text: message,
        isPending: true,
      };

      this.setState({ messages });
      console.log(`Message submitted: ${content.url}`);

      // Once the transaction has been mined we need to clean up the UI
      // state so that the latest message no longer says pending. 
      const checkReceipt = this.accountInterval = window.setInterval(() => {
        this.checkTransactionStatus(checkReceipt, content.hash, message);
      }, 1000);
    } else {
      console.error('Unexpected error when submitting the message.');
    }

    this.setState({ submittingMessage: false });
  }

  /**
   * Helper function that pings getTransactionReceipt for a specific tx hash.
   * Interval will ping every second until the transaction has been mined.
   */
  checkTransactionStatus = async (interval, hash, message) => {
    const contractInfo = await this.getContractInfo();
    const web3 = new Web3(new Web3.providers.HttpProvider(contractInfo.endpoint));
    
    web3.eth.getTransactionReceipt(hash, (error, receipt) => {
      if (error) {
        console.error(error);
        clearInterval(interval);
      }

      if (receipt && receipt.status) {
        const messages = Object.assign({}, this.state.messages);
        messages[hash] = {
          text: message,
          isPending: false,
        };
        this.setState({ messages });
        clearInterval(interval);
      }
    });
  }
  
  /**
   * Helper method that reads info from the server about the ForTheRecord contract.
   * The response contains the Web3 endpoint, contract ABI, & contract Address
   */ 
  getContractInfo = async () => {
    const rawResponse = await fetch(`/contractInfo`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });
    
    return await rawResponse.json();
  };

  /**
   * Within the componentDidMount, we read the event log of our smart contract.
   * This allows us to populate the app state with previous messages from the contract.
   * 
   * Currently, reading events is pretty slow, so in this demo app, we only check the last 1000 blocks.
   */
  componentDidMount = () => {
    (async () => {
      this.setState({ loadingMessages: true });

      const contractInfo = await this.getContractInfo();
      const web3 = new Web3(new Web3.providers.HttpProvider(contractInfo.endpoint));
      const contract = new web3.eth.Contract(contractInfo.abi, contractInfo.address);

      const blockNum = await web3.eth.getBlockNumber();
      const thousandBlocksAgo = (blockNum - 1000).toString();

      contract.getPastEvents('AllEvents', { fromBlock: thousandBlocksAgo, toBlock: 'latest' }, (error, eventLogs) => {
        const messages = {};
        if (!error) {
          eventLogs.forEach(event => {
            messages[event.transactionHash] = {
              text: event.returnValues.message,
              isPending: false,
            }
          });

          this.setState({ messages });
        } else {
          console.log(`An unexpected error occurred when reading event logs: ${error}`)
        }

        this.setState({ loadingMessages: false });
      });
    })();
  }

  render() {
    return (
      <div className={this.props.classes.root}>
        <RecordInput submitMessage={this.submitMessage} submittingMessage={this.state.submittingMessage} />
        <RecordList messages={this.state.messages} transactionHashes={this.state.transactionHashes} loadingMessages={this.state.loadingMessages} />
        <div className={this.props.classes.flex}/>
        <div className={this.props.classes.footer}>
          <Typography>Made with <span role="img" aria-label="heart">❤️</span> by <a target="_blank" rel="noopener noreferrer" href="https://nodesmith.io/aion.html">Nodesmith</a></Typography>
        </div>
      </div>
    );
  }
}

App.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(App);
