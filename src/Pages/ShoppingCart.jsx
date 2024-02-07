import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
function ShoppingCart() {
  return (
    <div className="h-screen p-4 ">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold">My Cart</div>
        <div className="text-xl font-bold">$0</div>
      </div>
      <div className="p-4 mt-4 bg-white rounded-lg bg-opacity-15">
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

    </div>
  );
}

export default ShoppingCart;
