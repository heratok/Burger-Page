// import HomeIcon from "@mui/icons-material/Home";
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
export default function Nav() {
  return (
    <div className="fixed z-50 bottom-0 right-0 flex w-full  justify-center items-center p-2 drop-shadow-2xl">
      <div className=" flex bg-black p-2 text-white rounded-full gap-2 hover:text-[#FF7A21] cursor-pointer">
        <div className="w-10 h-10 flex justify-center items-center bg-white bg-opacity-10 rounded-full">
          <ShoppingCartIcon fontSize="20px" />
        </div>
        <span className="flex justify-center items-center ">Orden</span>
      </div>
    </div>
  );
}
