import { parseAbi } from "viem";

export const ERC1155_ABI = parseAbi([
    "function balanceOf(address _owner, uint256 _id) external view returns (uint256)",
    "function balanceOfBatch(address[] _owners, uint256[] _ids) external view returns (uint256[])",
    "function safeTransferFrom(address _from, address _to, uint256 _id, uint256 _value, bytes _data) external",
    "function safeBatchTransferFrom(address _from, address _to, uint256[] _ids, uint256[] _values, bytes _data) external",
    "function setApprovalForAll(address _operator, bool _approved) external",
    "function isApprovedForAll(address _owner, address _operator) external view returns (bool)",
    "event TransferSingle(address indexed _operator, address indexed _from, address indexed _to, uint256 _id, uint256 _value)",
    "event TransferBatch(address indexed _operator, address indexed _from, address indexed _to, uint256[] _ids, uint256[] _values)",
    "event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved)",
    "event URI(string _value, uint256 indexed _id)",
]);
