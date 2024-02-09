import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ReplyIcon from '@mui/icons-material/Reply';

function ShoppingCart() {
  return (
    <div className="h-screen p-4 ">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold">My Cart</div>
        <div className="text-xl font-bold">$0</div>
      </div>
      <div className="p-4 mt-4 bg-white rounded-lg bg-opacity-15 lg:w-96">
        <div className="flex items-center">
          <div className="w-1/4">
            <img
              src ="https://static.vecteezy.com/system/resources/previews/026/791/864/non_2x/burger-generative-ai-free-png.png"
              alt="Instant Camera WHITE"
              className="object-cover w-full h-16"
            ></img>
          </div>
          <div className="w-3/4 pl-4">
            <div className="flex justify-between text-lg font-bold text-white"><div>Instant Camera</div><div><DeleteForeverIcon style={{color:"red"}}/></div> </div>
            <div className="text-white">WHITE</div>
            <div className="mt-2 text-lg font-bold text-white ">$132</div>
          </div>
        </div>
        <div className="flex items-center mt-4">
          <button className="w-8 h-8 bg-[#FFBF19] rounded-full">-</button>
          <div className="w-10 text-center text-white">1</div>
          <button className="w-8 h-8 rounded-full bg-[#FFBF19]">+</button>
        </div>
      </div>
      <button
        type="submit"
        className="text-white mt-5 flex justify-center items-center gap-1 bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-full px-5 py-2.5  lg:w-96 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
      > 
        Confirmar Orden
      </button>
      <button
        type="submit"
        className="text-white mt-5 flex justify-center items-center gap-1 bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full  lg:w-96 sm:w-full px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
      >
        <ReplyIcon/>
        Volver a la Tienda
      </button>

    </div>
  );
}

export default ShoppingCart;
