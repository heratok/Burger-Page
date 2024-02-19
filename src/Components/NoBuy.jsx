import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";

// eslint-disable-next-line react/prop-types
export default function NoBuy({volver}) {
    
  return (
    <div className="w-full   ">
      <div className="flex justify-center gap-2">
        <span className="">
          <ShoppingBasketIcon style={{ fontSize: "50px" }}></ShoppingBasketIcon>
        </span>
        <span className="flex justify-center items-center">
          Aqui apareceran las hamburguesas que elijas
        </span>
      </div>
      <div className="flex justify-center">
        <button
  
          className="inline-block rounded-full bg-neutral-50 px-6 pb-2 pt-2.5 text-xs font-medium uppercase leading-normal text-neutral-800 shadow-[0_4px_9px_-4px_#cbcbcb] transition duration-150 ease-in-out hover:bg-neutral-100 hover:shadow-[0_8px_9px_-4px_rgba(203,203,203,0.3),0_4px_18px_0_rgba(203,203,203,0.2)] focus:bg-neutral-100 focus:shadow-[0_8px_9px_-4px_rgba(203,203,203,0.3),0_4px_18px_0_rgba(203,203,203,0.2)] focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-[0_8px_9px_-4px_rgba(203,203,203,0.3),0_4px_18px_0_rgba(203,203,203,0.2)] dark:shadow-[0_4px_9px_-4px_rgba(251,251,251,0.3)] dark:hover:shadow-[0_8px_9px_-4px_rgba(251,251,251,0.1),0_4px_18px_0_rgba(251,251,251,0.05)] dark:focus:shadow-[0_8px_9px_-4px_rgba(251,251,251,0.1),0_4px_18px_0_rgba(251,251,251,0.05)] dark:active:shadow-[0_8px_9px_-4px_rgba(251,251,251,0.1),0_4px_18px_0_rgba(251,251,251,0.05)]"
          onClick={volver}
        >
          Comprar
        </button>
      </div>
    </div>
  );
}
