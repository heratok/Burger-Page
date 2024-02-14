import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import PersonIcon from "@mui/icons-material/Person";
import HomeIcon from "@mui/icons-material/Home";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ReplyIcon from "@mui/icons-material/Reply";

// eslint-disable-next-line react/prop-types
function Form({ cerrar, cerrarForm }) {
  const ocultar = () => {
    cerrar();
    cerrarForm();
  };

  return (
    <form className="max-w-sm mx-auto ">
      <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Nombres
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-2">
          <PersonIcon />
        </div>
        <input
          type="text"
          id="email-address-icon"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Nombres"
        ></input>
      </div>
      <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Telefono
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-2">
          <PhoneAndroidIcon />
        </div>
        <input
          type="text"
          id="email-address-icon"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Telefono"
        ></input>
      </div>
      <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Direccion
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-2">
          <HomeIcon />
        </div>
        <input
          type="text"
          id="email-address-icon"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Direccion"
        ></input>
      </div>

      <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
        Barrio
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 flex items-center pointer-events-none start-0 ps-2">
          <LocationOnIcon />
        </div>
        <input
          type="text"
          id="email-address-icon"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Barrio"
        ></input>
      </div>

      <div>
        <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Seleccionar metodo de pago
        </label>
        <select
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Seleccione un metodo de pago"
        >
          <option>Efectivo</option>
          <option>Transferencia</option>
        </select>
      </div>
      <form className="max-w-sm mx-auto">
        <label className="block mt-2 mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Mensaje opcional
        </label>
        <textarea
          id="message"
          rows="4"
          className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Ingrese un mensaje opcional"
        ></textarea>
      </form>

      <button className="text-white mt-5 flex justify-center items-center gap-1 bg-[#FF7A21] hover:bg-orange-400   font-medium rounded-lg text-sm w-full sm:w-full px-5 py-2.5  lg:w-96 text-center">
        <WhatsAppIcon />
        Enviar Orden a WhatsApp
      </button>
      <button
        className="text-white mt-5 flex justify-center items-center gap-1 bg-[#FF7A21] hover:bg-orange-400   font-medium rounded-lg text-sm w-full sm:w-full px-5 py-2.5  lg:w-96 text-center"
        onClick={ocultar}
      >
        <ReplyIcon />
        Volver a la Orden
      </button>
    </form>
  );
}

export default Form;
