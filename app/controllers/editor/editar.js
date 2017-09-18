import Ember from 'ember';
import { preview } from 'huayra-stopmotion/mlt-integration';

let Captura = Ember.Object.extend({
  href_miniatura: null,       // miniatura cuando se usa electron
  href: null,                 // ruta a la imagen cuando se usa electron
  data_miniatura: null,       // miniatura si NO se usa electron (chrome, firefox, tests ...)
  data: null,                 // imagen cuando NO se usa electro (chrome, firefox, tests ...)
});

function copyOnChange(what, where) {
  return Ember.on('init', Ember.observer(what, function() {
    return this.set(where, this.get(what));
  }));
}

export default Ember.Controller.extend({
  proyecto: Ember.inject.service(),
  camaras: Ember.inject.service(),

  cursor: 0,
  capturas: [],
  intervaloSeleccion: [0, 0],
  capturandoFoto: false,


  copiarCapturas: copyOnChange('capturas', 'cebolla.frames'),
  copiarCursor: copyOnChange('cursor', 'cebolla.cameraFrame'),

  mostrarGrilla: false,
  grilla: {
    filas: 3,
    columnas: 3,
    lineWidth: 1,
    style: 'black',
    dashFormat: []
  },

  mostrarCebolla: false,
  cebolla: {
    frames: [],      /* [ImageSources] from newer to older */
    futureFrames: 0, /* Integer */
    pastFrames: 3,   /* Integer */
    cameraFrame: 0,  /* Integer */
    alpha: 0.2,      /* Float */
  },

  mostrarTimeline: true,
  mostrarConfig: false,

  flipX: false,
  flipY: false,
  writeFlipped: false,
  hasAnyFlip: Ember.computed.or('flipX', 'flipY'),

  pantallaZoom: 1,

  haySeleccion: Ember.computed('intervaloSeleccion', function() {
    let seleccion = this.get('intervaloSeleccion');

    return !(seleccion[0] === 0 && seleccion[1] === 0);
  }),

  previewStream: null,
  previewEncoder: null,
  porcentajePreview: 0,
  cargandoPreview: Ember.computed.lt('porcentajePreview', 100),

  aplicar(cambios) {
    cambios.save();
  },

  actions: {
    seleccionarCamara(indice) {
      this.get('camaras').seleccionarCamara(indice);
    },

    guardar() {
      let cuadros = this.get("capturas");
      this.get('proyecto').guardarProyectoEnLaRuta(cuadros);
    },

    toggle: function(id) {
      this.toggleProperty('mostrarConfig');
      $(`#${id}`).sidebar('toggle');
    },

    previsualizar() {
      const seleccion = this.get('intervaloSeleccion');
      const path = this.get('model.ubicacion');
      const [video, encoder] = preview(seleccion, path, 24, (error, frame, porcentaje) => {
        this.set('porcentajePreview', porcentaje);
      });

      this.set('porcentajePreview', 0);
      this.set('previewStream', video);
      this.set('previewEncoder', encoder);

      /* Open modal */
      Ember.run.schedule('render', null, () => {
        $('.ui.preview.modal').modal('show');
      })
    },

    cerrarPreview() {
      const encoder = this.get('previewEncoder');

      if(encoder) {
        encoder.kill();
      }
    },

    eliminarCuadrosSeleccionados() {
      let a = this.get('intervaloSeleccion')[0];
      let b = this.get('intervaloSeleccion')[1];

      let primer_parte = this.get('capturas').slice(0, a);
      let segunda_parte = this.get('capturas').slice(b);

      this.set('capturas', primer_parte.concat(segunda_parte));

      this.set('intervaloSeleccion', [0, 0]);
    },

    capturar() {
      const writeFlipped = this.get('writeFlipped');
      const flipx = writeFlipped && this.get('flipX');
      const flipy = writeFlipped && this.get('flipY');

      this.set('capturandoFoto', true);

      this.get('camaras').capturarFrame(this.get('model.ubicacion'), flipx, flipy).then((fotos) => {
        this.set('capturandoFoto', false);
        let data = {};

        if (inElectron) {
          data.href_miniatura = fotos.ruta_miniatura;
          data.href = fotos.ruta_captura;
        } else {
          data.data_miniatura = fotos.miniatura;
          data.data = fotos.captura;
        }

        const cursor = this.get('cursor');

        this.get('capturas').splice(cursor, 0, Captura.create(data));
        this.get('capturas').arrayContentDidChange(cursor, 0, 1);

        this.set('cursor', this.get('cursor') + 1);

      }, (error) => {
        this.set('capturandoFoto', false);
        console.error(error);
        alert(error);
      });
    },

    moverCuadro(desde, hasta) {
      /**
       * Hay casos planteados:
       *  1. Los cuadros que se mueven están ANTES o DESPUES del cursor, y se intercambian sin más
       *  2. Se mueve un cuadro de un lado al otro del cursor y se lo ajusta de acuerdo a eso
       */
       const capturas =  this.get('capturas');
       const dragged = capturas.get(desde);
       const cursor = this.get('cursor');

       /* Quito la captura que draggié */
       capturas.splice(desde, 1);
       if(desde < hasta) {
         capturas.splice(hasta - 1, 0, dragged);
       } else {
         capturas.splice(hasta, 0, dragged);
       }

       if(desde > cursor && hasta < cursor) {
          this.set('cursor', cursor + 1);
        } else if(desde < cursor && hasta > cursor) {
          this.set('cursor', cursor - 1);
        }

        capturas.arrayContentDidChange(Math.min(desde, hasta));

       return capturas;
    },

    moverCursor(hasta) {
      this.set('cursor', hasta);
    }
  }
});
