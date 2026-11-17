// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Checkout {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title Aevum Checkout
/// @notice Single-token exact-amount invoices with direct merchant settlement.
/// @dev Deploy with the official tUSD8 address only after independently confirming it.
contract Checkout {
    struct Invoice {
        address merchant;
        uint256 amount;
        uint64 createdAt;
        address payer;
        uint64 paidAt;
    }

    IERC20Checkout public immutable token;
    uint256 public nextInvoiceId = 1;
    mapping(uint256 => Invoice) public invoices;
    uint256 private _entered = 1;

    error ZeroAddress();
    error ZeroAmount();
    error UnknownInvoice();
    error AlreadyPaid();
    error MerchantCannotPayOwnInvoice();
    error TransferFailed();
    error ReentrantCall();

    event InvoiceCreated(uint256 indexed invoiceId, address indexed merchant, uint256 amount);
    event InvoicePaid(uint256 indexed invoiceId, address indexed payer, address indexed merchant, uint256 amount);

    constructor(address tokenAddress) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        token = IERC20Checkout(tokenAddress);
    }

    function createInvoice(uint256 amount) external returns (uint256 invoiceId) {
        if (amount == 0) revert ZeroAmount();
        invoiceId = nextInvoiceId++;
        invoices[invoiceId] = Invoice(msg.sender, amount, uint64(block.timestamp), address(0), 0);
        emit InvoiceCreated(invoiceId, msg.sender, amount);
    }

    /// @notice Payer must approve this contract for the exact invoice amount first.
    /// Tokens are transferred directly from payer to merchant; the contract holds no funds.
    function pay(uint256 invoiceId) external {
        if (_entered != 1) revert ReentrantCall();
        Invoice storage invoice = invoices[invoiceId];
        if (invoice.merchant == address(0)) revert UnknownInvoice();
        if (invoice.payer != address(0)) revert AlreadyPaid();
        if (msg.sender == invoice.merchant) revert MerchantCannotPayOwnInvoice();

        _entered = 2;
        invoice.payer = msg.sender;
        invoice.paidAt = uint64(block.timestamp);
        bool ok = token.transferFrom(msg.sender, invoice.merchant, invoice.amount);
        if (!ok) revert TransferFailed();
        _entered = 1;
        emit InvoicePaid(invoiceId, msg.sender, invoice.merchant, invoice.amount);
    }
}
