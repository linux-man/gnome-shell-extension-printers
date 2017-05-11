const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('printers');
const _ = Gettext.gettext;

const PrintersSettings = new GObject.Class({
    Name: 'Printers-Settings',
    Extends: Gtk.Grid,

    _init: function(params) {
        //Gtk Grid init
        this.parent(params);
        this.set_orientation(Gtk.Orientation.VERTICAL);
        this.set_row_spacing(10);
        this.margin = 20;

        //Open settings
        this._settings = Convenience.getSettings();
        this._settings.connect('changed', Lang.bind(this, this._loadSettings));

        //interface
        let label = new Gtk.Label({label: _('Interface') + ': ', xalign: 0, hexpand: true});
        let model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);
        this._interfaceCombo = new Gtk.ComboBox({model: model});
        this._interfaceCombo.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);
        let renderer = new Gtk.CellRendererText();
        this._interfaceCombo.pack_start(renderer, true);
        this._interfaceCombo.add_attribute(renderer, 'text', 1);
        let iter = model.append();
        model.set(iter, [0, 1], [0, _('Gnome Control Center')]);
        iter = model.append();
        model.set(iter, [0, 1], [1, _('system-config-printer')]);
        this._interfaceCombo.connect('changed', Lang.bind(this, function(entry) {
            let [success, iter] = this._interfaceCombo.get_active_iter()
            if (success) this._settings.set_enum('connect-to', this._interfaceCombo.get_model().get_value(iter, 0));
        }));
        this.attach(label, 1, 1, 1, 1);
        this.attach_next_to(this._interfaceCombo, label, 1, 1, 1);

        //show-icon
        label = new Gtk.Label({label: _('Show icon') + ': ', xalign: 0, hexpand: true});
        model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);
        this._showIconCombo = new Gtk.ComboBox({model: model});
        this._showIconCombo.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);        
        renderer = new Gtk.CellRendererText();
        this._showIconCombo.pack_start(renderer, true);
        this._showIconCombo.add_attribute(renderer, 'text', 1);
        iter = model.append();
        model.set(iter, [0, 1], [0, _('Always')]);
        iter = model.append();
        model.set(iter, [0, 1], [1, _('When printers exist')]);
        iter = model.append();
        model.set(iter, [0, 1], [2, _('When printing')]);
        this._showIconCombo.connect('changed', Lang.bind(this, function(entry) {
            let [success, iter] = this._showIconCombo.get_active_iter()
            if (success) this._settings.set_enum('show-icon', this._showIconCombo.get_model().get_value(iter, 0));
        }));
        this.attach(label, 1, 2, 1, 1);
        this.attach_next_to(this._showIconCombo, label, 1, 1, 1);

        //show-error
        label = new Gtk.Label({label: _('Show printer error icon') + ': ', xalign: 0, hexpand: true});
        this._showErrorCheckbox = new Gtk.Switch();
        this._showErrorCheckbox.connect('notify::active',  Lang.bind(this, function(button) {
            this._settings.set_boolean('show-error', button.active);
        }));
        this.attach(label, 1, 3, 1, 1);
        this.attach_next_to(this._showErrorCheckbox, label, 1, 1, 1);

        //show-jobs
        label = new Gtk.Label({label: _('Show documents count next to icon') + ': ', xalign: 0, hexpand: true});
        this._showJobsCheckbox = new Gtk.Switch();
        this._showJobsCheckbox.connect('notify::active',  Lang.bind(this, function(button) {
            this._settings.set_boolean('show-jobs', button.active);
        }));
        this.attach(label, 1, 4, 1, 1);
        this.attach_next_to(this._showJobsCheckbox, label, 1, 1, 1);

        //job-number
        label = new Gtk.Label({label: _('Show each document number on print list') + ': ', xalign: 0, hexpand: true});
        this._jobNumberCheckbox = new Gtk.Switch();
        this._jobNumberCheckbox.connect('notify::active',  Lang.bind(this, function(button) {
            this._settings.set_boolean('job-number', button.active);
        }));
        this.attach(label, 1, 5, 1, 1);
        this.attach_next_to(this._jobNumberCheckbox, label, 1, 1, 1);

        //send-to-front
        label = new Gtk.Label({label: _('Documents can be sent to front') + ': ', xalign: 0, hexpand: true});
        this._sendToFrontCheckbox = new Gtk.Switch();
        this._sendToFrontCheckbox.connect('notify::active',  Lang.bind(this, function(button) {
            this._settings.set_boolean('send-to-front', button.active);
        }));
        this.attach(label, 1, 6, 1, 1);
        this.attach_next_to(this._sendToFrontCheckbox, label, 1, 1, 1);

        this._loadSettings();
    },

    _loadSettings: function() {
        this._interfaceCombo.set_active(this._settings.get_enum('connect-to'));
        this._showIconCombo.set_active(this._settings.get_enum('show-icon'));
        this._showErrorCheckbox.set_active(this._settings.get_boolean('show-error'));
        this._showJobsCheckbox.set_active(this._settings.get_boolean('show-jobs'));
        this._jobNumberCheckbox.set_active(this._settings.get_boolean('job-number'));
        this._sendToFrontCheckbox.set_active(this._settings.get_boolean('send-to-front'));
    }
});

function init() {
    Convenience.initTranslations('printers');
}

function buildPrefsWidget() {
    let widget = new PrintersSettings();
    widget.show_all();

    return widget;
}
