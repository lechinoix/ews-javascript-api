﻿import { ArgumentOutOfRangeException } from "../Exceptions/ArgumentException";
import { ArrayHelper, StringHelper, TypeSystem } from "../ExtensionMethods";
import { EwsLogging } from "../Core/EwsLogging";
import { EwsServiceJsonReader } from "../Core/EwsServiceJsonReader";
import { EwsServiceXmlWriter } from "../Core/EwsServiceXmlWriter";
import { ExchangeService } from "../Core/ExchangeService";
import { ICustomUpdateSerializer } from "../Interfaces/ICustomXmlUpdateSerializer";
import { IEnumerable } from "../Interfaces/IEnumerable";
import { PropertyDefinition } from "../PropertyDefinitions/PropertyDefinition";
import { ServiceLocalException } from '../Exceptions/ServiceLocalException';
import { ServiceObject } from "../Core/ServiceObjects/ServiceObject";
import { Strings } from "../Strings";
import { XmlNamespace } from "../Enumerations/XmlNamespace";

import { ComplexProperty } from "./ComplexProperty";
/**
 * Represents a collection of properties that can be sent to and retrieved from EWS.
 * 
 * @type <TComplexProperty>   ComplexProperty type.
 */
export abstract class ComplexPropertyCollection<TComplexProperty extends ComplexProperty> extends ComplexProperty implements IEnumerable<TComplexProperty>, ICustomUpdateSerializer {

    ___typeGenerics: string[] = ["ComplexProperty"];

    private items: TComplexProperty[] = [];
    private addedItems: TComplexProperty[] = [];
    private modifiedItems: TComplexProperty[] = [];
    private removedItems: TComplexProperty[] = [];

    /**
     * @internal Gets the items. (workaround for GetEnumerator)
     * 
     * @return The items.
     */
    get Items(): TComplexProperty[] { return this.items; }

    /**
     * @internal Gets the added items.
     *
     * @return The added items.
     */
    get AddedItems(): TComplexProperty[] { return this.addedItems; }

    /**
     * @internal Gets the modified items.
     *
     * @return The modified items
     */
    get ModifiedItems(): TComplexProperty[] { return this.modifiedItems; }

    /**
     * @internal Gets the removed items.
     * 
     * @return The removed items.
     */
    get RemovedItems(): TComplexProperty[] { return this.removedItems; }

    /**
     * Gets the total number of properties in the collection.
     */
    get Count(): number { return this.items.length; }

    /**
     * Gets the property at the specified index.
     *
     * @param   {number}   index   The zero-based index of the property to get.
     * @return  {TComplexProperty}           The property at the specified index.
     */
    _getItem(index: number): TComplexProperty {
        if (index < 0 || index >= this.Count) {
            throw new ArgumentOutOfRangeException("index", Strings.IndexIsOutOfRange);
        }
        return this.items[index];
    }

    /**
     * @internal Initializes a new instance of the  class.
     *
     */
    constructor() {
        super();
    }

    /**
     * @internal Clears the change log.
     */
    ClearChangeLog(): void {
        this.removedItems.splice(0);
        this.addedItems.splice(0);
        this.modifiedItems.splice(0);
    }

    /**
     * Determines whether a specific property is in the collection.
     *
     * @param   {TComplexProperty}   complexProperty   The property to locate in the collection.
     * @return  {boolean}           True if the property was found in the collection, false otherwise.
     */
    Contains(complexProperty: TComplexProperty): boolean { return this.items.indexOf(complexProperty) >= 0; }

    /**
     * @internal Creates the complex property.
     *
     * @param   {string}   xmlElementName   Name of the XML element.
     * @return  {TComplexProperty}          Complex property instance.
     */
    abstract CreateComplexProperty(xmlElementName: string): TComplexProperty;

    /**
     * @internal Creates the default complex property.
     *
     * @return  {TComplexProperty}      Complex property instance.
     */
    abstract CreateDefaultComplexProperty(): TComplexProperty;

    /**
     * @internal Loads from XMLJsObject collection to create a new collection item.
     *
     * @interface   IJsonCollectionDeserializer
     * 
     * @param   {any}               jsObjectCollection   The json collection.
     * @param   {ExchangeService}   service          The service.
     */
    CreateFromXmlJsObjectCollection(jsObjectCollection: any, service: ExchangeService): void {
        let collection: TComplexProperty[] = jsObjectCollection;
        if (!ArrayHelper.isArray(collection)) {
            collection = [];
            let collectionElement = this.GetCollectionItemXmlElementName(null);
            let typeName = TypeSystem.GetJsObjectTypeName(jsObjectCollection)
            if (collectionElement === null || (typeName && collectionElement === typeName)) {
                collection = [jsObjectCollection];
            }
            else {

                for (let key in jsObjectCollection) {
                    if (key.indexOf("__") === 0) //skip xmljsobject conversion entries like __type and __prefix
                        continue;

                    let collectionObj: TComplexProperty[] = jsObjectCollection[key];
                    if (!ArrayHelper.isArray(collectionObj)) {
                        collectionObj = EwsServiceJsonReader.ReadAsArray(jsObjectCollection, key);
                    }

                    ArrayHelper.AddRange(collection, collectionObj);
                }
            }
        }

        for (let jsonObject of collection) {
            let jsonProperty = jsonObject;

            if (jsonProperty != null) {
                let complexProperty: TComplexProperty = null;

                // If type property is present, use it. Otherwise create default property instance.
                // Note: polymorphic collections (such as Attachments) need a type property so
                // the CreateDefaultComplexProperty call will fail.
                if (TypeSystem.GetJsObjectTypeName(jsonProperty)) {
                    complexProperty = this.CreateComplexProperty(TypeSystem.GetJsObjectTypeName(jsonProperty));
                }
                else {
                    complexProperty = this.CreateDefaultComplexProperty();
                }

                if (complexProperty != null) {
                    complexProperty.LoadFromXmlJsObject(jsonProperty, service);
                    this.InternalAdd(complexProperty, true);
                }
            }
        }
    }

    /**
     * @internal Gets the name of the collection item XML element.
     *
     * @param   {TComplexProperty}   complexProperty   The complex property.
     * @return  {string}            XML element name.
     */
    abstract GetCollectionItemXmlElementName(complexProperty: TComplexProperty): string;

	/**
     *  Returns an enumerator that iterates through the collection. this case this.items
     */
    GetEnumerator(): TComplexProperty[] {
        return this.items;
    }

    /**
     * Searches for a specific property and return its zero-based index within the collection.
     *
     * @param   {TComplexProperty}   complexProperty   The property to locate in the collection.
     * @return  {number}                     The zero-based index of the property within the collection.
     */
    IndexOf(complexProperty: TComplexProperty): number {
        return this.items.indexOf(complexProperty);
    }

    /**
     * @internal Add complex property.
     *
     * @param   {TComplexProperty}   complexProperty   The complex property.
     */
    InternalAdd(complexProperty: TComplexProperty): void;
    /**
     * @private Add complex property.
     *
     * @param   {TComplexProperty}   complexProperty   The complex property.
     * @param   {boolean}   loading           If true, collection is being loaded.
     */
    InternalAdd(complexProperty: TComplexProperty, loading: boolean): void;
    InternalAdd(complexProperty: TComplexProperty, loading: boolean = false): void {
        EwsLogging.Assert(
            complexProperty != null,
            "ComplexPropertyCollection.InternalAdd",
            "complexProperty is null");

        if (this.items.indexOf(complexProperty) < 0) {
            this.items.push(complexProperty);
            if (!loading) {
                ArrayHelper.RemoveEntry(this.removedItems, complexProperty);// this.removedItems.Remove(complexProperty);
                this.addedItems.push(complexProperty);
            }
            complexProperty.OnChange.push(this.ItemChanged.bind(this));
            this.Changed();
        }
    }

    /**
     * @internal Clear collection.
     */
    InternalClear(): void {
        while (this.Count > 0) {
            this.InternalRemoveAt(0);
        }
    }

    /**
     * @internal Remove specified complex property.
     *
     * @param   {TComplexProperty}   complexProperty   The complex property.
     * @return  {boolean}           True if the complex property was successfully removed from the collection, false otherwise.
     */
    InternalRemove(complexProperty: TComplexProperty): boolean {
        EwsLogging.Assert(
            complexProperty != null,
            "ComplexPropertyCollection.InternalRemove",
            "complexProperty is null");

        if (ArrayHelper.RemoveEntry(this.items, complexProperty)) { // this.items.Remove(complexProperty))

            ArrayHelper.RemoveEntry(complexProperty.OnChange, this.ItemChanged);// complexProperty.OnChange -= this.ItemChanged;

            if (this.addedItems.indexOf(complexProperty) < 0) {
                this.removedItems.push(complexProperty);
            }
            else {
                ArrayHelper.RemoveEntry(this.addedItems, complexProperty);// this.addedItems.Remove(complexProperty);
            }
            ArrayHelper.RemoveEntry(this.modifiedItems, complexProperty);// this.modifiedItems.Remove(complexProperty);
            this.Changed();
            return true;
        }
        else {
            return false;
        }
    }

    /**
     * @internal Remote entry at index.
     *
     * @param   {number}   index   The index.
     */
    InternalRemoveAt(index: number): void {
        EwsLogging.Assert(
            index >= 0 && index < this.Count,
            "ComplexPropertyCollection.InternalRemoveAt",
            "index is out of range.");

        this.InternalRemove(this.items[index]);
    }

    /**
     * @internal Item changed.
     *
     * @param   {ComplexProperty}   complexProperty   The complex property.
     */
    ItemChanged(complexProperty: ComplexProperty): void {
        //TComplexProperty property = complexProperty as TComplexProperty;
        let property = complexProperty;
        // EwsLogging.Assert(
        //     property != null,
        //     "ComplexPropertyCollection.ItemChanged",
        //     StringHelper.Format("ComplexPropertyCollection.ItemChanged: the type of the complexProperty argument ({0}) is not supported.", complexProperty.___typeName));

        if (this.addedItems.indexOf(<TComplexProperty>property) < 0) {
            if (this.modifiedItems.indexOf(<TComplexProperty>property) < 0) {
                this.modifiedItems.push(<TComplexProperty>property);
                this.Changed();
            }
        }
    }

    /**
     * @internal Loads service object from XML.
     *
     * @param   {any}				jsObject	Json Object converted from XML.
     * @param   {ExchangeService}	service	The service.    
     */
	LoadFromXmlJsObject(jsObject: any, service: ExchangeService): void {
        EwsLogging.Assert(false, "ComplexPropertyCollection.LoadFromXmlJsObject", "LoadFromXmlJsObject was called, should not be calling. Fix it to direct to Create or Update call instad.")
        this.CreateFromXmlJsObjectCollection(jsObject, service);
    }

    /**
     * @internal Removes from change log.
     *
     * @param   {TComplexProperty}   complexProperty   The complex property.
     */
    RemoveFromChangeLog(complexProperty: TComplexProperty): void {
        ArrayHelper.RemoveEntry(this.removedItems, complexProperty);     //this.removedItems.Remove(complexProperty);
        ArrayHelper.RemoveEntry(this.modifiedItems, complexProperty);    //this.modifiedItems.Remove(complexProperty);
        ArrayHelper.RemoveEntry(this.addedItems, complexProperty);       //this.addedItems.Remove(complexProperty);
    }

    /**
     * @internal Determine whether we should write collection to XML or not.
     *
     * @return  {boolean}      True if collection contains at least one element.
     */
    ShouldWriteToRequest(): boolean {
        // Only write collection if it has at least one element.
        return this.Count > 0;
    }

    /**
     * @internal Loads from XMLJsObject collection to update collection Items.
     *
     * @interface   IJsonCollectionDeserializer
     * 
     * @param   {any}               jsObjectCollection   The XMLJsObject collection.
     * @param   {ExchangeService}   service          The service.
     */
    UpdateFromXmlJsObjectCollection(jsObjectCollection: any, service: ExchangeService): void {
        let collection: TComplexProperty[] = jsObjectCollection;
        if (!ArrayHelper.isArray(collection)) {
            collection = [];
            let collectionElement = this.GetCollectionItemXmlElementName(null);
            let typeName = TypeSystem.GetJsObjectTypeName(jsObjectCollection)
            if (collectionElement === null || (typeName && collectionElement === typeName)) {
                collection = [jsObjectCollection];
            }
            else {

                for (let key in jsObjectCollection) {
                    if (key.indexOf("__") === 0) //skip xmljsobject conversion entries like __type and __prefix
                        continue;

                    let collectionObj: TComplexProperty[] = jsObjectCollection[key];
                    if (!ArrayHelper.isArray(collectionObj)) {
                        collectionObj = EwsServiceJsonReader.ReadAsArray(jsObjectCollection, key);
                    }

                    ArrayHelper.AddRange(collection, collectionObj);
                }
            }
        }

        if (this.Count != collection.length) {
            throw new ServiceLocalException(Strings.PropertyCollectionSizeMismatch);
        }

        let index: number = 0;
        for (let jsonObject of collection) {
            let jsonProperty = jsonObject;

            if (jsonProperty != null) {
                let expectedComplexProperty: TComplexProperty = null;

                if (TypeSystem.GetJsObjectTypeName(jsonProperty)) {
                    expectedComplexProperty = this.CreateComplexProperty(TypeSystem.GetJsObjectTypeName(jsonProperty));
                }
                else {
                    expectedComplexProperty = this.CreateDefaultComplexProperty();
                }

                let actualComplexProperty: TComplexProperty = this._getItem(index++);

                if (expectedComplexProperty == null || !(actualComplexProperty instanceof expectedComplexProperty.constructor)) {
                    throw new ServiceLocalException(Strings.PropertyTypeIncompatibleWhenUpdatingCollection);
                }
                actualComplexProperty.LoadFromXmlJsObject(jsonProperty, service);
            }
            else {
                throw new ServiceLocalException();
            }
        }
    }

    /**
     * @internal Writes elements to XML.
     *
     * @param   {EwsServiceXmlWriter}   writer   The writer.
     */
    WriteElementsToXml(writer: EwsServiceXmlWriter): void {
        for (let complexProperty of this.items) {
            complexProperty.WriteToXml(writer, this.GetCollectionItemXmlElementName(complexProperty));
        }
    }

    /**
     * @internal Writes to XML.
     *
     * @param   {EwsServiceXmlWriter}   writer           The writer.
     * @param   {XmlNamespace}          xmlNamespace     The XML namespace.
     * @param   {string}                xmlElementName   Name of the XML element.
     */
    WriteToXml(writer: EwsServiceXmlWriter, xmlElementName: string, xmlNamespace: XmlNamespace = XmlNamespace.Types): void {
        if (this.ShouldWriteToRequest()) {
            super.WriteToXml(
                writer,
                xmlElementName,
                xmlNamespace);
        }
    }

    /**
     * @internal Writes the update to XML.
     * ICustomUpdateSerializer.WriteSetUpdateToXml
     *
     * @param   {EwsServiceXmlWriter}   writer               The writer.
     * @param   {ServiceObject}         ewsObject            The ews object.
     * @param   {PropertyDefinition}    propertyDefinition   Property definition.
     * @return  {boolean}               True if property generated serialization.
     */
    WriteSetUpdateToXml(
        writer: EwsServiceXmlWriter,
        ewsObject: ServiceObject,
        propertyDefinition: PropertyDefinition): boolean {
        // If the collection is empty, delete the property.
        if (this.Count == 0) {
            writer.WriteStartElement(XmlNamespace.Types, ewsObject.GetDeleteFieldXmlElementName());
            propertyDefinition.WriteToXml(writer);
            writer.WriteEndElement();
            return true;
        }
        // Otherwise, use the default XML serializer.
        else {
            return false;
        }
    }

    /**
     * @internal Writes the deletion update to XML.
     * ICustomUpdateSerializer.WriteDeleteUpdateToXml
     *
     * @param   {EwsServiceXmlWriter}   writer      The writer.
     * @param   {ServiceObject}         ewsObject   The ews object.
     * @return  {boolean}               True if property generated serialization.
     */
    WriteDeleteUpdateToXml(writer: EwsServiceXmlWriter, ewsObject: ServiceObject): boolean {
        // Use the default XML serializer.
        return false;
    }
}