// import HomeIcon from "@mui/icons-material/Home";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";

// eslint-disable-next-line react/prop-types
export default function Nav({ mostrar, cantidad }) {
  return (
    <div
      className="fixed z-50 bottom-0 right-0 flex w-full  justify-center items-center p-1 drop-shadow-2xl"
      onClick={mostrar}
    >
      <div className=" flex bg-black p-1 text-white rounded-full gap-2 hover:text-[#FF7A21] cursor-pointer">
        <div className="relative w-10 h-10 flex justify-center items-center bg-white bg-opacity-10 rounded-full">
          <ShoppingCartIcon fontSize="20px" />
          <div className="absolute top-0 left-7   text-[#C5150C]  font-bold">
            <div className=" text-[10px] flex justify-center items-center  rounded-full h-5 w-5 text-black bg-white font-bold">
              {cantidad}
            </div>
          </div>
        </div>

        <span className=" flex justify-center items-center ">Orden</span>
      </div>
    </div>
  );
}
