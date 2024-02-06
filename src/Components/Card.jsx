/* eslint-disable react/prop-types */
// eslint-disable-next-line react/prop-types
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";

export default function Card({ hamburger, onCliked }) {
  const cliked = () => {
    onCliked();
  };
  return (
    <div className="dark:bg-[#232228] bg-white text-black dark:text-white rounded-lg  lg:mt-4 md:mt-0 mt-5 p-4   h-72 ml-4 mr-4">
      <div className="flex justify-center">
        <img className="w-28" src={hamburger.src} alt="" />
      </div>
      <span className="font-bold flex justify-center "> {hamburger.name}</span>

      <p>{hamburger.description} </p>
      <div className="flex justify-between ">
        <span className="flex justify-center items-center text-[#FFBF19] font-bold">
          ${hamburger.price.toLocaleString()}
        </span>
        <div className="rounded-lg flex justify-center cursor-pointer hover:bg-opacity-20 items-center bg-white w-8 h-8 bg-opacity-10" onClick={cliked}>
          <AddShoppingCartIcon></AddShoppingCartIcon>
        </div>
      </div>
    </div>
  );
}
